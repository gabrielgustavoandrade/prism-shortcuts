chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.type !== "copy") return;

  const textarea = document.getElementById("text");
  textarea.value = String(msg.text ?? "");
  textarea.select();
  document.execCommand("copy");
});
