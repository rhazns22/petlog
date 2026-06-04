
import { Storage } from '@google-cloud/storage';
import fs from 'fs';

// Firebase Storage 버킷 이름
const bucketName = 'project-d9b9f7eb-f9c3-4b1c-8fc.firebasestorage.app';

async function setCors() {
  console.log('🔄 CORS 설정을 시도합니다...');
  
  // 만약 서비스 계정 키 파일이 있다면 자동으로 사용하도록 설정 가능
  // const storage = new Storage({ keyFilename: 'service-account.json' });
  const storage = new Storage();

  try {
    await storage.bucket(bucketName).setCorsConfiguration([
      {
        maxAgeSeconds: 3600,
        method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'],
        origin: ['*'],
        responseHeader: ['Content-Type', 'Authorization', 'x-goog-resumable'],
      },
    ]);
    console.log('✅ 성공: Firebase Storage CORS 설정이 완료되었습니다!');
  } catch (err) {
    console.error('❌ 실패: 권한이 없습니다. (Google Cloud SDK에 로그인되어 있지 않음)');
    console.log('\n--- 해결 방법 ---');
    console.log('1. 브라우저에서 아래 주소에 접속하세요:');
    console.log('   https://shell.cloud.google.com/?show=terminal');
    console.log('\n2. 열린 터미널에 아래 명령어를 복사해서 붙여넣으세요:');
    console.log(`   gsutil cors set cors.json gs://${bucketName}`);
  }
}

// cors.json 파일도 함께 생성
const corsConfig = [
  {
    "origin": ["*"],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "responseHeader": ["Content-Type", "Authorization", "x-goog-resumable"],
    "maxAgeSeconds": 3600
  }
];
fs.writeFileSync('cors.json', JSON.stringify(corsConfig, null, 2));

setCors();
