import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.mjs';

export const passwordHash = (password) => bcrypt.hash(password, 12);
export const passwordMatches = (password, hash) => bcrypt.compare(password, hash);
export const newRefreshToken = () => crypto.randomBytes(48).toString('base64url');
export const hashRefreshToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
export const createAccessToken = (user) => jwt.sign({ sub: user.id }, config.ACCESS_TOKEN_SECRET, { expiresIn: config.ACCESS_TOKEN_TTL, issuer: 'balancevault' });
export const verifyAccessToken = (token) => jwt.verify(token, config.ACCESS_TOKEN_SECRET, { issuer: 'balancevault' });

export function safeTokenEquals(candidate, expected) {
  if (typeof candidate !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  // timingSafeEqual requires equal-length inputs; compare a fixed-size digest in all cases.
  const digestA = crypto.createHash('sha256').update(a).digest();
  const digestB = crypto.createHash('sha256').update(b).digest();
  const equalDigest = crypto.timingSafeEqual(digestA, digestB);
  return equalDigest && a.length === b.length;
}
