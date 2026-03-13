export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'missing url' });
  try {
    const upstream = await fetch(decodeURIComponent(url), {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const data = await upstream.json();
    res.setHeader('Cache-Control', 's-maxage=60');
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
