import { FirebaseError } from 'firebase/app';

export interface FriendlyError {
  title: string;
  message: string;
  rawCode?: string;
  rawMessage?: string;
}

const FIRESTORE_MESSAGES: Record<string, FriendlyError> = {
  'permission-denied': {
    title: 'Permission denied',
    message:
      'You don’t have permission to do that. If this seems wrong, try signing out and back in.',
  },
  unauthenticated: {
    title: 'Session expired',
    message: 'Your session expired. Sign in again to continue.',
  },
  unavailable: {
    title: 'Service unavailable',
    message:
      'We couldn’t reach the server. Check your connection and try again shortly.',
  },
  'deadline-exceeded': {
    title: 'Taking too long',
    message:
      'The operation took longer than expected. Check your connection and try again.',
  },
  'not-found': {
    title: 'Not found',
    message: 'What you looked for wasn’t found or was removed.',
  },
  'already-exists': {
    title: 'Already exists',
    message: 'This already exists. Refresh the page and try again.',
  },
  'resource-exhausted': {
    title: 'Limit reached',
    message: 'The system is overloaded. Try again in a few minutes.',
  },
  'failed-precondition': {
    title: 'Could not complete',
    message:
      'This action couldn’t be completed in the current state. Refresh and try again.',
  },
  cancelled: {
    title: 'Cancelled',
    message: 'The operation was cancelled.',
  },
  'data-loss': {
    title: 'Data error',
    message: 'Something went wrong with the data. Please try again.',
  },
  internal: {
    title: 'Internal error',
    message: 'We hit a server problem. Try again shortly.',
  },
};

const AUTH_MESSAGES: Record<string, FriendlyError> = {
  'auth/invalid-credential': {
    title: 'Incorrect email or password',
    message: 'Check your details and try again.',
  },
  'auth/wrong-password': {
    title: 'Incorrect password',
    message: 'The password you entered doesn’t match.',
  },
  'auth/user-not-found': {
    title: 'User not found',
    message: 'We couldn’t find an account with that email.',
  },
  'auth/email-already-in-use': {
    title: 'Email already registered',
    message: 'An account with this email already exists. Try signing in.',
  },
  'auth/invalid-email': {
    title: 'Invalid email',
    message: 'The email format doesn’t look valid.',
  },
  'auth/weak-password': {
    title: 'Weak password',
    message: 'Use a password with at least 6 characters.',
  },
  'auth/too-many-requests': {
    title: 'Too many attempts',
    message:
      'You tried several times in a row. Wait a few minutes before trying again.',
  },
  'auth/network-request-failed': {
    title: 'No connection',
    message: 'We couldn’t connect. Check your internet and try again.',
  },
  'auth/popup-closed-by-user': {
    title: 'Sign-in cancelled',
    message: 'The sign-in window was closed before finishing.',
  },
  'auth/requires-recent-login': {
    title: 'Sign in again',
    message: 'For security, sign in again to do this action.',
  },
};

const STORAGE_MESSAGES: Record<string, FriendlyError> = {
  'storage/unauthorized': {
    title: 'Permission denied',
    message: 'You don’t have permission to upload this file.',
  },
  'storage/canceled': {
    title: 'Upload cancelled',
    message: 'The file upload was cancelled.',
  },
  'storage/quota-exceeded': {
    title: 'Storage limit',
    message: 'Storage space is full. Contact support.',
  },
  'storage/retry-limit-exceeded': {
    title: 'Upload failed',
    message: 'We couldn’t upload the file. Check your connection.',
  },
};

const GENERIC: FriendlyError = {
  title: 'Something went wrong',
  message:
    'An unexpected error occurred. Try again shortly — if it persists, contact support.',
};

const NETWORK: FriendlyError = {
  title: 'No connection',
  message:
    'You appear to be offline. Check your internet and try again.',
};

function isOffline(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.onLine === false;
}

export function getFriendlyError(err: unknown): FriendlyError {
  if (isOffline()) {
    return { ...NETWORK, rawMessage: rawMessageFromUnknown(err) };
  }

  if (err instanceof FirebaseError) {
    const code = err.code;
    const found =
      FIRESTORE_MESSAGES[code] ||
      FIRESTORE_MESSAGES[code.replace(/^firestore\//, '')] ||
      AUTH_MESSAGES[code] ||
      STORAGE_MESSAGES[code];
    if (found) {
      return { ...found, rawCode: code, rawMessage: err.message };
    }
    return { ...GENERIC, rawCode: code, rawMessage: err.message };
  }

  if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
    return { ...NETWORK, rawMessage: err.message };
  }

  if (err instanceof Error) {
    return { ...GENERIC, rawMessage: err.message };
  }

  return GENERIC;
}

function rawMessageFromUnknown(err: unknown): string | undefined {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return undefined;
}

export function logError(context: string, err: unknown): void {
  if (typeof console !== 'undefined') {
    console.error(`[${context}]`, err);
  }
}
