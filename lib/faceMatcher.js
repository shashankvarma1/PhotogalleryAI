// lib/faceMatcher.js — shared face matching used by upload route + people page
import pool from "./db";

export function euclidean(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

export function averageDescriptor(descriptors) {
  if (!descriptors.length) return [];
  const len = descriptors[0].length;
  const avg = new Array(len).fill(0);
  for (const d of descriptors) for (let i = 0; i < len; i++) avg[i] += d[i];
  return avg.map(v => v / descriptors.length);
}

const MATCH_THRESHOLD = 0.6;

export async function matchFaceToPeople(descriptor, username) {
  if (!descriptor?.length) return [];
  const people = await pool.query(
    "SELECT id, name, face_descriptor FROM people WHERE username = $1",
    [username]
  );
  const matches = [];
  for (const person of people.rows) {
    const dist = euclidean(descriptor, person.face_descriptor);
    if (dist < MATCH_THRESHOLD) {
      matches.push({ id: person.id, name: person.name, confidence: +(1 - dist / MATCH_THRESHOLD).toFixed(3) });
    }
  }
  return matches.sort((a, b) => b.confidence - a.confidence);
}