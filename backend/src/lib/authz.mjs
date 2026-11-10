import { AppError } from './errors.mjs';

export function hasRole(user, role) {
  return Array.isArray(user?.roles) && user.roles.includes(role);
}

export function assertAccountOwner(userId, account) {
  if (!account || account.userId !== userId) throw new AppError(404, 'NOT_FOUND', 'Resource not found.');
  return account;
}
