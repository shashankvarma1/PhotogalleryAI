// app/api/auth/forgot-password/route.js
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import crypto from "crypto";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email?.trim()) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    // Check if user exists
    const userRes = await pool.query(
      "SELECT id, email, username FROM users WHERE email = $1 LIMIT 1",
      [email.toLowerCase().trim()]
    );

    // Always return success even if email not found (security best practice)
    if (!userRes.rows.length) {
      return NextResponse.json({ message: "If that email exists, a reset link has been sent." });
    }

    const user = userRes.rows[0];

    // Delete any existing unused tokens for this email
    await pool.query(
      "DELETE FROM password_reset_tokens WHERE email = $1",
      [email.toLowerCase().trim()]
    );

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    // Store token
    await pool.query(
      "INSERT INTO password_reset_tokens (email, token, expires_at) VALUES ($1, $2, $3)",
      [email.toLowerCase().trim(), token, expiresAt]
    );

    const resetUrl = `${APP_URL}/reset-password?token=${token}`;

    // Send email via Resend
    await resend.emails.send({
      from: "Gathrd <noreply@gathrd.com>",
      to: user.email,
      subject: "Reset your Gathrd password",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          </head>
          <body style="margin:0;padding:0;background:#f2efe9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2efe9;padding:48px 24px;">
              <tr>
                <td align="center">
                  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#faf8f4;border-radius:20px;border:1px solid rgba(17,17,17,0.08);overflow:hidden;">
                    
                    <!-- Header -->
                    <tr>
                      <td style="padding:36px 40px 0;text-align:center;">
                        <p style="margin:0;font-size:22px;font-weight:800;letter-spacing:-0.05em;color:#111;">gathrd</p>
                      </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                      <td style="padding:32px 40px;">
                        <h1 style="margin:0 0 12px;font-size:26px;font-weight:400;font-style:italic;color:#111;line-height:1.2;">Reset your password</h1>
                        <p style="margin:0 0 8px;font-size:14px;color:rgba(17,17,17,0.55);line-height:1.6;">
                          Hi ${user.username},
                        </p>
                        <p style="margin:0 0 28px;font-size:14px;color:rgba(17,17,17,0.55);line-height:1.6;">
                          We received a request to reset your password. Click the button below to choose a new one. This link expires in <strong>1 hour</strong>.
                        </p>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center">
                              <a href="${resetUrl}"
                                style="display:inline-block;padding:14px 32px;background:#111;color:#f2efe9;text-decoration:none;border-radius:100px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">
                                Reset Password →
                              </a>
                            </td>
                          </tr>
                        </table>
                        <p style="margin:28px 0 0;font-size:12px;color:rgba(17,17,17,0.35);line-height:1.6;text-align:center;">
                          If you didn't request this, you can safely ignore this email.<br/>
                          Your password won't change until you click the link above.
                        </p>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="padding:0 40px 32px;text-align:center;border-top:1px solid rgba(17,17,17,0.07);">
                        <p style="margin:24px 0 0;font-size:11px;color:rgba(17,17,17,0.3);">
                          © ${new Date().getFullYear()} Gathrd. All rights reserved.
                        </p>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });

    return NextResponse.json({ message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    console.error("Forgot password error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}