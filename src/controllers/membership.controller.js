import { createApplication, getAllApplications } from "../models/MembershipApplication.js";
import { notifyCommittee } from "../config/email.js";

export async function applyForMembership(req, res) {
  const { fullName, yearOfStudy, phone, email, message } = req.body;

  if (!fullName || !email) {
    return res.status(400).json({ error: "Full name and email are required." });
  }

  try {
    const application = await createApplication({ fullName, yearOfStudy, phone, email, message });

    await notifyCommittee(
      "New MUTMLSA membership application",
      `<h2>New membership application</h2>
       <p><strong>Name:</strong> ${fullName}</p>
       <p><strong>Year of study:</strong> ${yearOfStudy || "—"}</p>
       <p><strong>Phone:</strong> ${phone || "—"}</p>
       <p><strong>Email:</strong> ${email}</p>
       <p><strong>Message:</strong> ${message || "—"}</p>`
    );

    res.status(201).json({ success: true, application });
  } catch (err) {
    console.error("Error creating membership application:", err);
    res.status(500).json({ error: "Something went wrong. Please try again later." });
  }
}

export async function listApplications(req, res) {
  try {
    const applications = await getAllApplications();
    res.json({ applications });
  } catch (err) {
    console.error("Error fetching applications:", err);
    res.status(500).json({ error: "Could not fetch applications." });
  }
}
