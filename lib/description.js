// lib/description.js — shared description builder used by upload + reindex + tag routes

export function buildDescription({ caption = null, filename = "", exif = {}, faceCount = 0, emotion = null, peopleNames = [] } = {}) {
  const parts = [];

  if (caption) {
    parts.push(caption.endsWith(".") ? caption : caption + ".");
  } else {
    const cleaned = filename.replace(/\.[^.]+$/, "").replace(/^\d+-/, "").replace(/[-_]+/g, " ").trim();
    if (cleaned) parts.push(`Photo: ${cleaned}.`);
  }

  if (exif?.DateTimeOriginal) {
    parts.push(`Taken on ${new Date(exif.DateTimeOriginal).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.`);
  }

  if (exif?.Make) {
    parts.push(`Shot on ${exif.Make}${exif.Model ? " " + exif.Model : ""}.`);
  }

  if (peopleNames?.length) {
    parts.push(`People in photo: ${peopleNames.join(", ")}.`);
  } else if (faceCount > 0) {
    const emotionText = emotion && emotion !== "neutral" ? `, appearing ${emotion}` : "";
    parts.push(`${faceCount === 1 ? "One person" : `${faceCount} people`} visible${emotionText}.`);
  }

  if (exif?.latitude && exif?.longitude) {
    parts.push(`GPS: ${Number(exif.latitude).toFixed(4)}, ${Number(exif.longitude).toFixed(4)}.`);
  }

  return parts.join(" ");
}

export function updateDescriptionWithPeople(currentDesc, personNames) {
  let desc = (currentDesc ?? "").replace(/People in (?:this )?photo:[^.]+\./g, "").trim();
  if (personNames.length > 0) {
    desc = (desc + ` People in photo: ${personNames.join(", ")}.`).trim();
  }
  return desc;
}