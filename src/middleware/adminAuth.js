// Simple shared-password gate for the admin-only "view submissions" routes.
// Not a full auth system on purpose — this is internal tooling for one
// person, not a public-facing login. Send the password as a header:
//   x-admin-password: <ADMIN_PASSWORD>
export function adminAuth(req, res, next) {
  const provided = req.headers["x-admin-password"];

  if (!process.env.ADMIN_PASSWORD) {
    console.warn("ADMIN_PASSWORD not set in .env — admin routes are unprotected!");
    return next();
  }

  if (provided !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  next();
}
