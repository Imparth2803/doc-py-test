const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=invalid_key`;
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] })
}).then(res => {
  console.log("Status:", res.status);
  return res.text();
}).then(console.log).catch(console.error);
