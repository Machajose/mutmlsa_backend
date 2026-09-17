import rateLimit from "express-rate-limit";

// General limiter for public form submissions — generous enough for
// real visitors, but stops rapid spam.
export const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 submissions per IP per window
  message: { error: "Too many submissions from this device. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for the admin login — makes brute-forcing the
// password impractical without locking out a legitimate admin
// who mistypes it once or twice.
export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 20 attempts per 15 min per IP
  message: { error: "Too many login attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Looser limiter for the chatbot — protects against spam/cost abuse
// without interrupting a normal back-and-forth conversation.
export const chatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 15,
  message: { error: "You're sending messages too quickly. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});