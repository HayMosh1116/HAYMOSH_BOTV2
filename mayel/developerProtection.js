const HAYWHY_DEVELOPER_NUMBER = "2349122761580";

function digits(value) {
  return String(value || "").split("@")[0].split(":")[0].replace(/\D/g, "");
}

function isProtectedDeveloper(...values) {
  return values.some((value) => {
    if (value && typeof value === "object") {
      return [value.id, value.pn, value.phoneNumber, value.jid, value.lid]
        .some((id) => digits(id) === HAYWHY_DEVELOPER_NUMBER);
    }
    return digits(value) === HAYWHY_DEVELOPER_NUMBER;
  });
}

module.exports = { HAYWHY_DEVELOPER_NUMBER, isProtectedDeveloper, digits };
