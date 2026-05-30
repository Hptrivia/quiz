const fs = require('fs');

async function postToPinterest(imagePath, pinData) {
  const token = process.env.PINTEREST_ACCESS_TOKEN;

  if (!token) {
    console.log('PINTEREST_ACCESS_TOKEN not set — skipping post');
    return;
  }

  if (!pinData.boardId) {
    console.error(`No board ID for category: ${pinData.category}. Set the correct GitHub secret.`);
    return;
  }

  const imageBase64 = fs.readFileSync(imagePath).toString('base64');

  const body = {
    board_id: pinData.boardId,
    title: pinData.pinTitle,
    description: pinData.description,
    link: pinData.themeUrl,
    media_source: {
      source_type: 'image_base64',
      content_type: 'image/png',
      data: imageBase64,
    },
  };

  const response = await fetch('https://api.pinterest.com/v5/pins', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Pinterest API ${response.status}: ${err}`);
  }

  const result = await response.json();
  console.log(`Posted to Pinterest — pin ID: ${result.id}`);
  return result;
}

module.exports = { postToPinterest };
