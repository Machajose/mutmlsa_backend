import {
  createMember,
  getAllMembers,
  getPaymentsForPeriod,
  setPaymentStatus,
  setRegistrationPaid,
  setRegistrationNumber,
  getMemberByEmail,
  getMemberPayment,
} from "../models/Member.js";
import {
  getPendingApplications,
  markApplicationConfirmed,
} from "../models/MembershipApplication.js";
import { normalizeRegNumber, isValidRegNumber } from "../utils/regNumber.js";

const CURRENT_PERIOD = { academicYear: "2026/2027", semester: "Sem 1" };

export async function listMembers(req, res) {
  try {
    const { academicYear, semester } = req.query;
    const members = await getAllMembers();

    let payments = [];
    if (academicYear && semester) {
      payments = await getPaymentsForPeriod(academicYear, semester);
    }

    const merged = members.map((m) => {
      const payment = payments.find((p) => p.member_id === m.id);
      return { ...m, paidThisPeriod: payment ? payment.paid : false };
    });

    res.json({ members: merged });
  } catch (err) {
    console.error("Error listing members:", err);
    res.status(500).json({ error: "Could not fetch members." });
  }
}

export async function listPendingApplications(req, res) {
  try {
    const applications = await getPendingApplications();
    res.json({ applications });
  } catch (err) {
    console.error("Error listing pending applications:", err);
    res.status(500).json({ error: "Could not fetch applications." });
  }
}

export async function addMember(req, res) {
  const { fullName, email, phone, yearOfStudy, applicationId, registrationNumber } = req.body;

  if (!fullName) {
    return res.status(400).json({ error: "Full name is required." });
  }

  try {
    const member = await createMember({
      fullName,
      email,
      phone,
      yearOfStudy,
      registrationNumber: registrationNumber ? normalizeRegNumber(registrationNumber) : undefined,
    });

    if (applicationId) {
      await markApplicationConfirmed(applicationId);
    }

    res.status(201).json({ success: true, member });
  } catch (err) {
    console.error("Error adding member:", err);
    res.status(500).json({ error: "Could not add member." });
  }
}

export async function updatePayment(req, res) {
  const { id } = req.params;
  const { academicYear, semester, paid } = req.body;

  if (!academicYear || !semester || typeof paid !== "boolean") {
    return res.status(400).json({ error: "academicYear, semester, and paid are required." });
  }

  try {
    const payment = await setPaymentStatus({
      memberId: Number(id),
      academicYear,
      semester,
      paid,
    });
    res.json({ success: true, payment });
  } catch (err) {
    console.error("Error updating payment:", err);
    res.status(500).json({ error: "Could not update payment status." });
  }
}

export async function updateRegistration(req, res) {
  const { id } = req.params;
  const { paid } = req.body;

  if (typeof paid !== "boolean") {
    return res.status(400).json({ error: "paid must be a boolean." });
  }

  try {
    const member = await setRegistrationPaid(Number(id), paid);
    res.json({ success: true, member });
  } catch (err) {
    console.error("Error updating registration status:", err);
    res.status(500).json({ error: "Could not update registration status." });
  }
}

export async function updateRegistrationNumber(req, res) {
  const { id } = req.params;
  const raw = (req.body.registrationNumber || "").trim();

  if (raw && !isValidRegNumber(raw)) {
    return res.status(400).json({ error: "Invalid format — expected something like MS200/2535/2023." });
  }

  try {
    const member = await setRegistrationNumber(Number(id), raw ? normalizeRegNumber(raw) : null);
    if (!member) return res.status(404).json({ error: "Member not found." });
    res.json({ member });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "That registration number is already linked to another member." });
    }
    console.error("Error saving registration number:", err);
    res.status(500).json({ error: "Could not save." });
  }
}

export async function checkMemberStatus(req, res) {
  const { email } = req.query;
  if (!email || !email.trim()) {
    return res.status(400).json({ error: "Email is required." });
  }

  try {
    const member = await getMemberByEmail(email.trim());
    if (!member) {
      return res.status(404).json({ error: "No member found with that email." });
    }

    const payment = await getMemberPayment(
      member.id,
      CURRENT_PERIOD.academicYear,
      CURRENT_PERIOD.semester
    );

    res.json({
      fullName: member.full_name,
      registrationPaid: member.registration_paid,
      semesterPaid: payment?.paid || false,
      academicYear: CURRENT_PERIOD.academicYear,
      semester: CURRENT_PERIOD.semester,
    });
  } catch (err) {
    console.error("Error checking member status:", err);
    res.status(500).json({ error: "Could not check status." });
  }
}