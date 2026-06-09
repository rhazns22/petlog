import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // JSON 바디에서 데이터 추출
  const { code, redirect_uri } = req.body;

  // 2. 환경 변수 체크 (Vercel 설정 확인)
  const REST_API_KEY = (process.env.VITE_KAKAO_REST_API_KEY || process.env.KAKAO_REST_API_KEY || '').trim().replace(/^"|"$/g, '');
  const CLIENT_SECRET = (process.env.VITE_KAKAO_CLIENT_SECRET || process.env.KAKAO_CLIENT_SECRET || '').trim().replace(/^"|"$/g, '');

  console.log('[Kakao Audit] REST_API_KEY Present:', !!REST_API_KEY);
  console.log('[Kakao Audit] CLIENT_SECRET Present:', !!CLIENT_SECRET);

  if (!REST_API_KEY) {
    return res.status(500).json({ error: 'REST_API_KEY가 없습니다. Vercel 설정을 확인하세요.' });
  }

  if (!code || !redirect_uri) {
    return res.status(400).json({ error: 'code 또는 redirect_uri가 누락되었습니다.' });
  }

  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', REST_API_KEY);
    params.append('redirect_uri', redirect_uri);
    params.append('code', code);
    
    // 비밀번호(Secret)가 설정되어 있을 때만 파라미터에 추가
    if (CLIENT_SECRET) {
      params.append('client_secret', CLIENT_SECRET);
    }

    console.log('[Kakao Request] 발송 준비:', {
      client_id: REST_API_KEY.substring(0, 5) + '...',
      redirect_uri: redirect_uri,
      has_secret: !!CLIENT_SECRET
    });

    const response = await axios.post(
      'https://kauth.kakao.com/oauth/token',
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
      }
    );

    console.log('[Kakao Success] 토큰 발급 성공');
    return res.status(200).json(response.data);
  } catch (error) {
    const kakaoError = error.response?.data || { error: 'Unknown', error_description: error.message };
    console.error('[Kakao Error] 상세 내용:', kakaoError);

    return res.status(error.response?.status || 500).json({
      error: 'Kakao Token Exchange Failed',
      kakao_detail: kakaoError,
      debug: {
        has_rest_key: !!REST_API_KEY,
        has_secret: !!CLIENT_SECRET,
        redirect_uri_sent: redirect_uri
      }
    });
  }
}
