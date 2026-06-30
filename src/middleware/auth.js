const supabase = require('../config/supabase');

module.exports = async (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '인증 토큰이 필요합니다.' } });
  }

  const token = header.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다.' } });
  }

  req.user = user;
  next();
};
