import { FirebaseError } from 'firebase/app';

export interface FriendlyError {
  title: string;
  message: string;
  rawCode?: string;
  rawMessage?: string;
}

const FIRESTORE_MESSAGES: Record<string, FriendlyError> = {
  'permission-denied': {
    title: 'Sem permissão',
    message:
      'Você não tem permissão para fazer essa ação. Se isso parece um erro, tente sair e entrar de novo.',
  },
  unauthenticated: {
    title: 'Sessão expirada',
    message: 'Sua sessão expirou. Faça login novamente para continuar.',
  },
  unavailable: {
    title: 'Serviço indisponível',
    message:
      'Não conseguimos falar com o servidor agora. Verifique sua internet e tente de novo em instantes.',
  },
  'deadline-exceeded': {
    title: 'Demorou demais',
    message:
      'A operação demorou mais que o esperado. Verifique sua conexão e tente novamente.',
  },
  'not-found': {
    title: 'Não encontrado',
    message: 'O que você buscou não foi encontrado ou foi removido.',
  },
  'already-exists': {
    title: 'Já existe',
    message: 'Isso já existe no sistema. Atualize a página e tente de novo.',
  },
  'resource-exhausted': {
    title: 'Limite atingido',
    message: 'O sistema está sobrecarregado. Tente de novo em alguns minutos.',
  },
  'failed-precondition': {
    title: 'Não foi possível concluir',
    message:
      'A ação não pôde ser feita no estado atual. Atualize a página e tente de novo.',
  },
  cancelled: {
    title: 'Cancelado',
    message: 'A operação foi cancelada.',
  },
  'data-loss': {
    title: 'Erro nos dados',
    message: 'Algo deu errado com os dados. Tente novamente.',
  },
  internal: {
    title: 'Erro interno',
    message: 'Tivemos um problema no servidor. Tente novamente em instantes.',
  },
};

const AUTH_MESSAGES: Record<string, FriendlyError> = {
  'auth/invalid-credential': {
    title: 'E-mail ou senha incorretos',
    message: 'Verifique seus dados e tente novamente.',
  },
  'auth/wrong-password': {
    title: 'Senha incorreta',
    message: 'A senha digitada não confere.',
  },
  'auth/user-not-found': {
    title: 'Usuário não encontrado',
    message: 'Não encontramos uma conta com esse e-mail.',
  },
  'auth/email-already-in-use': {
    title: 'E-mail já cadastrado',
    message: 'Já existe uma conta com esse e-mail. Tente fazer login.',
  },
  'auth/invalid-email': {
    title: 'E-mail inválido',
    message: 'O formato do e-mail não está correto.',
  },
  'auth/weak-password': {
    title: 'Senha fraca',
    message: 'Use uma senha com pelo menos 6 caracteres.',
  },
  'auth/too-many-requests': {
    title: 'Muitas tentativas',
    message:
      'Você tentou várias vezes seguidas. Aguarde alguns minutos antes de tentar de novo.',
  },
  'auth/network-request-failed': {
    title: 'Sem conexão',
    message: 'Não conseguimos conectar. Verifique sua internet e tente de novo.',
  },
  'auth/popup-closed-by-user': {
    title: 'Login cancelado',
    message: 'A janela de login foi fechada antes de concluir.',
  },
  'auth/requires-recent-login': {
    title: 'Faça login novamente',
    message: 'Por segurança, você precisa entrar de novo para fazer essa ação.',
  },
};

const STORAGE_MESSAGES: Record<string, FriendlyError> = {
  'storage/unauthorized': {
    title: 'Sem permissão',
    message: 'Você não tem permissão para enviar este arquivo.',
  },
  'storage/canceled': {
    title: 'Envio cancelado',
    message: 'O envio do arquivo foi cancelado.',
  },
  'storage/quota-exceeded': {
    title: 'Limite de armazenamento',
    message: 'Espaço de armazenamento esgotado. Avise o suporte.',
  },
  'storage/retry-limit-exceeded': {
    title: 'Falha no envio',
    message: 'Não conseguimos enviar o arquivo. Verifique sua conexão.',
  },
};

const GENERIC: FriendlyError = {
  title: 'Algo deu errado',
  message:
    'Ocorreu um erro inesperado. Tente novamente em instantes — se continuar, entre em contato com o suporte.',
};

const NETWORK: FriendlyError = {
  title: 'Sem conexão',
  message:
    'Você parece estar offline. Verifique sua internet e tente novamente.',
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
