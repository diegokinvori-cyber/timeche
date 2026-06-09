const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Conexión segura usando la caja fuerte de Netlify
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function cifrarDato(textoPlano) {
    const algoritmo = 'aes-256-gcm';
    const llave = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = crypto.randomBytes(12);
    
    const cipher = crypto.createCipheriv(algoritmo, llave, iv);
    let cifrado = cipher.update(textoPlano, 'utf8', 'hex');
    cifrado += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().hex();
    return `${iv.toString('hex')}:${cifrado}:${authTag}`;
}

exports.handler = async (event, context) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Método No Permitido" };
    }

    try {
        const { colaborador_concatenado, ubicacion_raw, nota_justificante } = JSON.parse(event.body);

        // Captura la IP real desde Netlify
        const ipCliente = event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || "127.0.0.1";

        // Ciframos los datos antes de mandarlos a Supabase
        const ipCifrada = cifrarDato(ipCliente);
        const ubicacionCifrada = cifrarDato(ubicacion_raw);
        const horaExacta = new Date().toISOString();
        const horaCifrada = cifrarDato(horaExacta);

        // Inserta en la base de datos en la nube
        const { data, error } = await supabase
            .from('registros_asistencia')
            .insert([
                { 
                    colaborador_concatenado, 
                    ip_cifrada: ipCifrada, 
                    ubicacion_cifrada: ubicacionCifrada,
                    hora_cifrada: horaCifrada,
                    hora_entrada_real: horaExacta,
                    nota_justificante,
                    fecha_dia: new Date().toISOString().split('T')[0]
                }
            ]);

        if (error) throw error;

        return {
            statusCode: 200,
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type"
            },
            body: JSON.stringify({ encabezado: "Éxito", mensaje: "Asistencia registrada correctamente." })
        };

    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};
