import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  try {
    const body = await req.json()
    
    // Supporte les deux formats : webhook profiles et trigger auth.users
    const record = body.record || body
    const email = record?.email || 'Inconnu'
    const display_name = record?.display_name || record?.raw_user_meta_data?.display_name || 'Sans pseudo'
    const created_at = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })

    const htmlContent = `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;background:#f8f9fa;">
        <div style="background:white;border-radius:16px;padding:40px;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
          <h1 style="color:#003DA6;font-size:24px;font-weight:900;margin:0 0 4px;">Memorabilius</h1>
          <p style="color:#999;font-size:13px;margin:0 0 24px;">Notification admin</p>
          <h2 style="font-size:20px;font-weight:800;color:#121212;margin:0 0 20px;">🎉 Nouvel inscrit !</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #eee;color:#999;font-size:13px;width:120px;">Pseudo</td>
              <td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:700;">${display_name}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #eee;color:#999;font-size:13px;">Email</td>
              <td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:700;">${email}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#999;font-size:13px;">Date</td>
              <td style="padding:10px 0;font-weight:700;">${created_at}</td>
            </tr>
          </table>
          <div style="margin-top:24px;">
            <a href="https://www.memorabilius.fr/annuaire" style="display:inline-block;background:#003DA6;color:white;padding:12px 24px;border-radius:50px;font-weight:800;font-size:14px;text-decoration:none;">Voir l'annuaire →</a>
          </div>
        </div>
      </div>
    `

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      },
      body: JSON.stringify({
        from: 'Memorabilius <contact@memorabilius.fr>',
        to: ['contact@memorabilius.fr'],
        subject: `🎉 Nouvel inscrit : ${display_name} (${email})`,
        html: htmlContent,
      }),
    })

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
