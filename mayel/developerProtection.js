const HAYWHY_DEVELOPER_NUMBER = "2349122761580";

function digits(value) {
  return String(value || "").split("@")[0].split(":")[0].replace(/\D/g, "");
}

function isProtectedDeveloper(...ids) {
  return ids.some((id) => digits(id) === HAYWHY_DEVELOPER_NUMBER);
}

module.exports = { HAYWHY_DEVELOPER_NUMBER, isProtectedDeveloper, digits };
