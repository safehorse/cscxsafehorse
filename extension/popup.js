const input = document.getElementById('token')
const status = document.getElementById('status')

chrome.storage.local.get('whatsappToken').then(({ whatsappToken }) => {
  if (whatsappToken) {
    input.value = whatsappToken
    status.textContent = 'Pareado. Abra o WhatsApp Web numa aba do Chrome.'
  }
})

document.getElementById('save').addEventListener('click', async () => {
  const value = input.value.trim()
  if (!value) return
  await chrome.storage.local.set({ whatsappToken: value })
  status.textContent = 'Salvo! Abra ou recarregue o WhatsApp Web.'
})
