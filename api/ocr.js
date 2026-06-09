import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const INVOKE_URL = process.env.OCR_INVOKE_URL || 'http://clovaocr-api-kr.ncloud.com/external/v1/52328/4fdb26aa714cfb1dde640907f6dded4b4ea32425059d52c41d3538e0b0b3162a';
  const SECRET_KEY = process.env.OCR_SECRET_KEY || 'aERjUWpIeHNVQWVYQWF4c0R3Z0VpaW9jaHpEQm5VaXA=';

  try {
    const response = await axios.post(
      INVOKE_URL,
      req.body,
      {
        headers: {
          'X-OCR-SECRET': SECRET_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    return res.status(200).json(response.data);
  } catch (error) {
    const errorData = error.response?.data || error.message;
    console.error('Server-side OCR Error:', errorData);
    // 상세 에러 내용을 클라이언트로 전달
    return res.status(500).json({ 
      error: 'OCR processing failed', 
      details: errorData 
    });
  }
}