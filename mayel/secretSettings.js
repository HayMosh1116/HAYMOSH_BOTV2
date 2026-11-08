const SECRET_SETTING_KEY = /(?:secret|token|password|passwd|api[_-]?key|session|credential|authorization|private[_-]?key|mongo(?:db)?[_-]?(?:uri|url)|database[_-]?url)/i;

function isSecretSettingKey(key) {
  return SECRET_SETTING_KEY.test(String(key || ''));
}

function filterSafeBotSettingRows(rows) {
  return (Array.isArray(rows) ? rows : []).filter(row => !isSecretSettingKey(row?.key));
}

module.exports = { isSecretSettingKey, filterSafeBotSettingRows };
