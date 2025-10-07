import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = "https://neighborly-ibex-402.convex.cloud";
const client = new ConvexHttpClient(CONVEX_URL);

async function testWebhookFlow() {
  console.log("🧪 Testando fluxo do webhook com número problemático...");
  
  // Simular dados do webhook do Twilio
  const webhookData = {
    From: "whatsapp:+554899330297", // 8 dígitos - deve normalizar para 9
    To: "whatsapp:+5548999999999",
    Body: "Teste de mensagem",
    MessageSid: "test_message_" + Date.now(),
    AccountSid: "test_account",
    NumMedia: "0"
  };
  
  try {
    // Chamar o endpoint do webhook
    const response = await fetch(`${CONVEX_URL}/whatsapp/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(webhookData).toString()
    });
    
    const result = await response.text();
    console.log("📥 Resposta do webhook:", result);
    
    // Verificar se o participante foi criado corretamente
    const participantsResult = await client.query("admin:getParticipants", {});
    console.log("Participants after webhook:", participantsResult);

    const participants = participantsResult.participants || [];
    const rafaelParticipants = participants.filter(p => 
      p.phone.includes("48999330297") || p.phone.includes("4899330297")
    );
    
    console.log("👥 Participantes encontrados para Rafael:");
    rafaelParticipants.forEach(p => {
      console.log(`  - ID: ${p._id}`);
      console.log(`  - Phone: ${p.phone}`);
      console.log(`  - Name: ${p.name || 'Sem nome'}`);
      console.log(`  - Created: ${new Date(p._creationTime).toLocaleString()}`);
      console.log("  ---");
    });
    
    if (rafaelParticipants.length > 1) {
      console.log("❌ PROBLEMA: Ainda existem duplicatas!");
    } else {
      console.log("✅ SUCESSO: Apenas um participante encontrado!");
    }
    
  } catch (error) {
    console.error("❌ Erro no teste:", error);
  }
}

testWebhookFlow();