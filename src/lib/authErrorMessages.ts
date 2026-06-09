/**
 * Firebase Auth 오류 코드를 사용자 친화적인 한국어 메시지로 변환합니다.
 */
export const getAuthErrorMessage = (code?: string): string => {
  switch (code) {
    case 'auth/email-already-in-use':
      return '이미 가입된 이메일입니다. 로그인 화면에서 로그인해 주세요.';
    case 'auth/popup-closed-by-user':
      return 'Google 로그인이 취소되었습니다.';
    case 'auth/invalid-email':
      return '이메일 형식이 올바르지 않습니다.';
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return '이메일 또는 비밀번호를 확인해 주세요.';
    case 'auth/weak-password':
      return '비밀번호는 6자 이상으로 입력해 주세요.';
    case 'auth/too-many-requests':
      return '로그인 시도가 많아 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.';
    case 'auth/operation-not-allowed':
      return '현재 이메일 로그인을 사용할 수 없습니다. Google 로그인을 이용해 주세요.';
    case 'auth/user-disabled':
      return '사용이 제한된 계정입니다. 문의하기를 이용해 주세요.';
    default:
      return '인증 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  }
};
