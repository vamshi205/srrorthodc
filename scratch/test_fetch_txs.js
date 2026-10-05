import https from 'https';

const url = 'https://firestore.googleapis.com/v1/projects/srrorthodc-antigravity/databases/(default)/documents/bank_transactions?pageSize=10';

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status code:', res.statusCode);
    try {
      const parsed = JSON.parse(data);
      console.log('Document count:', parsed.documents ? parsed.documents.length : 0);
      if (parsed.documents && parsed.documents.length > 0) {
        console.log('Sample doc fields:', JSON.stringify(parsed.documents[0].fields, null, 2));
      } else {
        console.log('Response body:', data.slice(0, 500));
      }
    } catch (e) {
      console.log('Raw response:', data.slice(0, 500));
    }
  });
}).on('error', (err) => {
  console.error('Error:', err);
});
