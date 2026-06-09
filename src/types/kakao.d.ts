// Kakao JS SDK v2 Type Declarations

interface KakaoAuthObj {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  refresh_token_expires_in: number;
}

interface KakaoUserAccount {
  email?: string;
  is_email_valid?: boolean;
  is_email_verified?: boolean;
  profile?: {
    nickname?: string;
    thumbnail_image_url?: string;
    profile_image_url?: string;
    is_default_image?: boolean;
  };
}

interface KakaoUserInfo {
  id: number;
  connected_at?: string;
  properties?: {
    nickname?: string;
    profile_image?: string;
    thumbnail_image?: string;
  };
  kakao_account?: KakaoUserAccount;
}

interface Window {
  Kakao: {
    init: (key: string) => void;
    isInitialized: () => boolean;
    Auth: {
      authorize: (settings: {
        redirectUri: string;
        scope?: string;
        state?: string;
        prompt?: string;
      }) => void;
      setAccessToken: (token: string, persist?: boolean) => void;
      logout: (callback?: () => void) => void;
      getStatusInfo: (callback: (statusObj: { status: string; user?: KakaoUserInfo }) => void) => void;
      getAccessToken: () => string | null;
    };
    API: {
      request: (settings: {
        url: string;
        success: (res: KakaoUserInfo) => void;
        fail: (err: unknown) => void;
      }) => void;
    };
  };
}
