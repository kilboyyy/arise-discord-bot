const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionFlagsBits,
    AttachmentBuilder,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const path = require('path');
const fs = require('fs');
const http = require('http');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const TOKEN = 'MTU0NzM0NzY1NjU2NzY5MzM5Mg.GnO0Zb.bUNzpzBMTt8ELrybuWG0x5ZO17R1ig9Yh9l_F4';
const LOGO_PATH = path.join(__dirname, 'logo.jpg');
const BANNER_PATH = path.join(__dirname, 'banner.jpg');
const SUPPORT_BANNER_PATH = path.join(__dirname, 'support_banner.jpg');
const TRANSCRIPTS_DIR = path.join(__dirname, 'transcripts');

if (!fs.existsSync(TRANSCRIPTS_DIR)) {
    fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
}

// 🌐 Servidor Nativo HTTP para Hospedar os Transcripts Web
const transcriptServer = http.createServer((req, res) => {
    if (req.url.startsWith('/transcript/')) {
        const id = req.url.split('/transcript/')[1].replace(/[^a-zA-Z0-9]/g, '');
        const filePath = path.join(TRANSCRIPTS_DIR, `transcript-${id}.html`);
        if (fs.existsSync(filePath)) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            return res.end(fs.readFileSync(filePath));
        }
    }
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404 - Transcript não encontrado</h1>');
});

transcriptServer.listen(3000, () => {
    console.log(`🌐 Servidor Web de Transcripts rodando em: http://localhost:3000`);
});

const cooldowns = new Map();
const ticketDataMap = new Map();
const orderDataMap = new Map(); // channelId => orderDetails

function generateTicketId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Função auxiliar para renderizar o embed de revisão do carrinho
function buildCartReviewPayload(orderInfo, user) {
    const subtotal = orderInfo.unitPrice * orderInfo.quantity;
    const discount = orderInfo.coupon ? (subtotal * (orderInfo.coupon.discountPercent / 100)) : 0;
    const finalPrice = subtotal - discount;
    const originalSubtotal = orderInfo.originalUnitPrice * orderInfo.quantity;

    const bannerAttachment = new AttachmentBuilder(BANNER_PATH, { name: 'banner.jpg' });

    const fields = [
        { 
            name: 'Valor à vista', 
            value: `De: ~~~R$ ${originalSubtotal.toFixed(2).replace('.', ',')}~~~\nPara : **R$ ${finalPrice.toFixed(2).replace('.', ',')}**`, 
            inline: true 
        },
        { 
            name: '📦 Em estoque', 
            value: `${orderInfo.stock}`, 
            inline: true 
        },
        { 
            name: 'Carrinho', 
            value: `\`${orderInfo.quantity}x ${orderInfo.planName} | R$ ${subtotal.toFixed(2).replace('.', ',')}\``, 
            inline: false 
        }
    ];

    if (orderInfo.coupon) {
        fields.push({
            name: '🏷️ Cupom Aplicado',
            value: `\`${orderInfo.coupon.code}\` (-${orderInfo.coupon.discountPercent}%) — Desconto de R$ ${discount.toFixed(2).replace('.', ',')}`,
            inline: false
        });
    }

    const reviewEmbed = new EmbedBuilder()
        .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
        .setTitle('Revisão do Pedido')
        .addFields(fields)
        .setColor('#2952FF')
        .setImage('attachment://banner.jpg');

    const cartActionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('btn_pay_order')
            .setLabel('✔ Ir para o Pagamento')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('btn_edit_quantity')
            .setLabel('✏️ Editar Quantidade')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('btn_use_coupon')
            .setLabel('🏷️ Usar Cupom')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('btn_cancel_order')
            .setLabel('🗑️ Cancelar')
            .setStyle(ButtonStyle.Danger)
    );

    return {
        embeds: [reviewEmbed],
        components: [cartActionRow],
        files: [bannerAttachment]
    };
}

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Unhandled Rejection:', reason);
});

client.on('error', (error) => {
    console.error('⚠️ Discord Client Error:', error);
});

client.once('clientReady', () => {
    console.log(`========================================`);
    console.log(`🤖 ARISE BOT conectado como: ${client.user.tag}`);
    console.log(`========================================`);
    
    client.user.setPresence({ status: 'online' });
    console.log(`👉 Comandos disponíveis: !painel, !spoofer-premium, !spoofer-faq`);
});

client.once('ready', () => {
    client.user.setPresence({ status: 'online' });
    console.log(`🤖 ARISE BOT Ativo e Conectado!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const cmd = message.content.toLowerCase();

    // 1. Painel de Suporte / Tickets Principal
    if (cmd === '!painel' || cmd === '!ticket') {
        try { await message.delete(); } catch(e){}

        const logoAttachment = new AttachmentBuilder(LOGO_PATH, { name: 'logo.jpg' });
        const bannerAttachment = new AttachmentBuilder(BANNER_PATH, { name: 'banner.jpg' });

        const embed = new EmbedBuilder()
            .setAuthor({ name: 'ARISE SUPPORT!' })
            .setDescription(
                '# Suporte Arise Protocol\n' +
                '• Selecione uma categoria abaixo para iniciar seu atendimento.\n\n' +
                '## Regras:\n' +
                '• Apenas um ticket por assunto.\n' +
                '• Sem spam ping na staff.\n' +
                '• Seja paciente; tempo de espera pode ser compensado.\n' +
                '• Compras via revendedor: contate-os diretamente.\n' +
                '**Suporte Ativo (24h)**\n\n\n' +
                '# Arise Protocol Support\n' +
                '• Choose a subject below to open a ticket.\n' +
                '**Rules:**\n' +
                '• One ticket per subject.\n' +
                '• No spam pinging staff.\n' +
                '• Be patient; lost time will be compensated.\n' +
                '• Bought from a reseller? Contact them first.\n' +
                '**Most Active Support (24h)**'
            )
            .setColor('#FFFFFF')
            .setThumbnail('attachment://logo.jpg')
            .setImage('attachment://banner.jpg');

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_category')
            .setPlaceholder('Selecione uma opção')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Technical Help')
                    .setDescription('Precisa de ajuda com nossos produtos ou serviços? Nossa equipe está pronta para oferecer suporte.')
                    .setValue('cat_suporte'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Billing Support')
                    .setDescription('Tem alguma pergunta ou curiosidade? Entre em contato conosco e receba respostas rápidas e precisas.')
                    .setValue('cat_compras'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Business / Affiliates')
                    .setDescription('Precisa de um Reset HWID? Solicite no ticket.')
                    .setValue('cat_reset_hwid')
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await message.channel.send({ 
            embeds: [embed], 
            components: [row],
            files: [logoAttachment, bannerAttachment]
        });
    }

    // 2. Painel de Vendas: Spoofer Premium (Carrinho de Compras)
    if (cmd === '!spoofer-premium' || cmd === '!vendas' || cmd === '!comprar') {
        try { await message.delete(); } catch(e){}

        const bannerAttachment = new AttachmentBuilder(BANNER_PATH, { name: 'banner.jpg' });

        const embed = new EmbedBuilder()
            .setAuthor({ name: 'Spoofer Premium — ARISE PROTOCOL' })
            .setTitle('Aqui você pode jogar com tudo ativado:')
            .setDescription(
                '• **TPM ON**\n' +
                '• **SecureBoot ON**\n' +
                '• **HVCI ON**\n' +
                '• **Não precisa ficar usando pendriver**\n' +
                '• **Funciona em NoteBook & Desktop**\n\n' +
                '# Sistema operacional:\n' +
                '• **Windows 10 e 11 (todas as versões)**\n' +
                '• **Processadores suportados:** Intel e AMD\n' +
                '• **Placas-mãe suportadas:** Todas.\n\n' +
                '# Jogos Triple A suportados:\n' +
                '• **VALORANT**\n' +
                '• **FORTNITE (Torneio Suportado)**\n' +
                '• **APEX LEGENDS**\n' +
                '• **RUST**\n' +
                '• **OVERWATCH 2**\n' +
                '• **COD (TODOS OS CODS)**\n' +
                '• **FIVEM**\n' +
                '• **DAYZ**\n' +
                '• **LOL**\n' +
                '• **TODOS OUTROS JOGOS...**\n\n' +
                '⚡ **Entrega Automática!**'
            )
            .setColor('#2952FF')
            .setImage('attachment://banner.jpg')
            .setFooter({ text: 'ARISE PROTOCOL #3K' });

        const planMenu = new StringSelectMenuBuilder()
            .setCustomId('select_buy_plan')
            .setPlaceholder('Selecione uma opção...')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('1 Dia(s)')
                    .setDescription('Valor: R$ 34,99 - Estoque: 28')
                    .setEmoji('🛒')
                    .setValue('plan_1day'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('7 Dia(s)')
                    .setDescription('Valor: R$ 59,99 - Estoque: 17')
                    .setEmoji('🛒')
                    .setValue('plan_7day'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('30 Dia(s)')
                    .setDescription('Valor: R$ 89,99 - Estoque: 23')
                    .setEmoji('🛒')
                    .setValue('plan_30day'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('LIFETIME !')
                    .setDescription('Valor: R$ 149,99 - Estoque: 29')
                    .setEmoji('🛒')
                    .setValue('plan_lifetime')
            );

        const row = new ActionRowBuilder().addComponents(planMenu);

        await message.channel.send({
            embeds: [embed],
            components: [row],
            files: [bannerAttachment]
        });
    }

    // 3. Informativo / FAQ do Spoofer Premium vs Básico
    if (cmd === '!spoofer-faq' || cmd === '!faq' || cmd === '!duvidas') {
        try { await message.delete(); } catch(e){}

        const logoAttachment = new AttachmentBuilder(LOGO_PATH, { name: 'logo.jpg' });

        const faqEmbed = new EmbedBuilder()
            .setAuthor({ name: 'ARISE PROTOCOL — Dúvidas Frequentes', iconURL: 'attachment://logo.jpg' })
            .setDescription(
                '# Qual a diferença entre os Sp00fes Premium e o Básico? ⚡\n\n' +
                '# Vantagens do Premium:\n' +
                '• **Não é necessário desativar TPM, SecureBoot ou HVCI**, você pode jogar com tudo ativado.\n' +
                '• **Compatível com todas as placas-mãe**, incluindo notebooks.\n' +
                '• **Não precisa ficar utilizando pendrive.**\n' +
                '• **Não precisa usar Warp ou outros métodos adicionais** para conseguir jogar.\n\n' +
                '# O produto vem com tutorial ensinando a usar? ⚡\n' +
                '• **Sim!** Tanto o Premium quanto o Básico acompanham um tutorial completo e bem explicado, em texto e vídeo.\n' +
                '• Após a compra, o material é enviado automaticamente junto com o sp00fer.\n\n' +
                '# Preciso usar o sp00fer toda vez antes de jogar ou quando reiniciar o computador? ⚡\n' +
                '• **Não.** O sp00fer precisa ser utilizado apenas uma vez para remover o banimento.\n' +
                '• Depois disso, não é necessário repetir o processo, apenas caso ocorra um novo banimento.'
            )
            .setColor('#2952FF')
            .setFooter({ text: 'ARISE PROTOCOL #3K — Suporte 24h', iconURL: 'attachment://logo.jpg' });

        await message.channel.send({ embeds: [faqEmbed], files: [logoAttachment] });
    }
});

// Handling Interactions (SelectMenus, Buttons, Modals)
client.on('interactionCreate', async (interaction) => {
    
    // --- 1. SELEÇÃO DE PLANO DE COMPRA (CRIAÇÃO DO CARRINHO COM 2-STEP EPHEMERAL) ---
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_buy_plan') {
        const val = interaction.values[0];
        const user = interaction.user;
        const guild = interaction.guild;

        // Step 1: Resposta efêmera inicial de carregamento (Print 2 - media_1788997275678.png)
        const creatingEmbed = new EmbedBuilder()
            .setTitle('⏳ CRIANDO SEU CARRINHO...')
            .setDescription('Aguarde um momento enquanto preparamos seu canal de compra exclusivo.')
            .setColor('#FEE75C');

        await interaction.reply({ embeds: [creatingEmbed], flags: MessageFlags.Ephemeral });

        let planName = 'Spoofer Premium - 1 Dia(s)';
        let unitPriceNum = 34.99;
        let originalUnitPriceNum = 44.99;
        let stock = '28';

        if (val === 'plan_7day') {
            planName = 'Spoofer Premium - 7 Dia(s)';
            unitPriceNum = 59.99;
            originalUnitPriceNum = 74.99;
            stock = '17';
        } else if (val === 'plan_30day') {
            planName = 'Spoofer Premium - 30 Dia(s)';
            unitPriceNum = 89.99;
            originalUnitPriceNum = 109.99;
            stock = '23';
        } else if (val === 'plan_lifetime') {
            planName = 'Spoofer Premium - LIFETIME !';
            unitPriceNum = 149.99;
            originalUnitPriceNum = 199.99;
            stock = '29';
        }

        const cleanUser = user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
        const orderId = generateTicketId(6).toLowerCase();
        const cartChannelName = `🛒・pedido-${cleanUser}-${orderId}`;

        try {
            const cartChannel = await guild.channels.create({
                name: cartChannelName,
                type: ChannelType.GuildText,
                parent: interaction.channel.parentId || undefined,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks
                        ]
                    },
                    {
                        id: client.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ManageChannels
                        ]
                    }
                ]
            });

            const initialOrderData = {
                user: user,
                planName: planName,
                unitPrice: unitPriceNum,
                originalUnitPrice: originalUnitPriceNum,
                quantity: 1,
                coupon: null,
                stock: stock,
                orderId: orderId,
                reviewMessageId: null
            };

            const payload = buildCartReviewPayload(initialOrderData, user);
            const sentMsg = await cartChannel.send({
                content: `${user}`,
                embeds: payload.embeds,
                components: payload.components,
                files: payload.files
            });

            initialOrderData.reviewMessageId = sentMsg.id;
            orderDataMap.set(cartChannel.id, initialOrderData);

            // Step 2: Edição da resposta efêmera confirmando o sucesso (Print 2 & 3 - media_1788997275678.png)
            const successCartEmbed = new EmbedBuilder()
                .setTitle('✔ PEDIDO CRIADO COM SUCESSO')
                .setDescription('Seu carrinho foi aberto em um canal de pedido privado.\nClique no botão abaixo para acessar e finalizar a compra com desconto!')
                .setColor('#57F287');

            const linkCartRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('🔗 Ir ao carrinho')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://discord.com/channels/${guild.id}/${cartChannel.id}`)
            );

            return interaction.editReply({
                embeds: [successCartEmbed],
                components: [linkCartRow]
            });

        } catch (err) {
            console.error('Erro ao criar carrinho:', err);
            return interaction.editReply({
                content: '❌ Ocorreu um erro ao criar o seu carrinho de compras.'
            });
        }
    }

    // --- 2. MODAIS (SUBMIT HANDLERS) ---
    if (interaction.isModalSubmit()) {
        const orderInfo = orderDataMap.get(interaction.channel.id);

        if (interaction.customId === 'modal_edit_quantity') {
            if (!orderInfo) {
                return interaction.reply({ content: '❌ Informações do pedido não encontradas.', flags: MessageFlags.Ephemeral });
            }

            const inputVal = interaction.fields.getTextInputValue('input_quantity');
            const qty = parseInt(inputVal, 10);

            if (isNaN(qty) || qty < 1 || qty > 999) {
                return interaction.reply({ content: '❌ Por favor, digite um número válido entre 1 e 999.', flags: MessageFlags.Ephemeral });
            }

            orderInfo.quantity = qty;
            orderDataMap.set(interaction.channel.id, orderInfo);

            const payload = buildCartReviewPayload(orderInfo, interaction.user);

            try {
                if (orderInfo.reviewMessageId) {
                    const reviewMsg = await interaction.channel.messages.fetch(orderInfo.reviewMessageId);
                    if (reviewMsg) {
                        await reviewMsg.edit({ embeds: payload.embeds, components: payload.components });
                    }
                }
            } catch (e) {
                console.error('Erro ao atualizar mensagem do carrinho:', e);
            }

            return interaction.reply({
                content: `✅ Quantidade alterada para **${qty}x** com sucesso!`,
                flags: MessageFlags.Ephemeral
            });
        }

        if (interaction.customId === 'modal_apply_coupon') {
            if (!orderInfo) {
                return interaction.reply({ content: '❌ Informações do pedido não encontradas.', flags: MessageFlags.Ephemeral });
            }

            const codeInput = interaction.fields.getTextInputValue('input_coupon_code').trim().toUpperCase();

            let discountPercent = 10; // Padrão 10% de desconto
            if (codeInput === 'COD20' || codeInput === 'DESCONTO20' || codeInput === 'ARISE20') {
                discountPercent = 20;
            } else if (codeInput === 'LIFETIME50' || codeInput === 'SUPER50') {
                discountPercent = 50;
            }

            orderInfo.coupon = {
                code: codeInput,
                discountPercent: discountPercent
            };
            orderDataMap.set(interaction.channel.id, orderInfo);

            const payload = buildCartReviewPayload(orderInfo, interaction.user);

            try {
                if (orderInfo.reviewMessageId) {
                    const reviewMsg = await interaction.channel.messages.fetch(orderInfo.reviewMessageId);
                    if (reviewMsg) {
                        await reviewMsg.edit({ embeds: payload.embeds, components: payload.components });
                    }
                }
            } catch (e) {
                console.error('Erro ao atualizar mensagem do carrinho:', e);
            }

            return interaction.reply({
                content: `🎉 Cupom **\`${codeInput}\`** aplicado com sucesso! Você ganhou **${discountPercent}% OFF**!`,
                flags: MessageFlags.Ephemeral
            });
        }
    }

    // --- 3. BOTÕES DENTRO DO CARRINHO DE COMPRAS ---
    if (interaction.isButton()) {
        const orderInfo = orderDataMap.get(interaction.channel.id);

        // A. Modal Editar Quantidade (Print 4 - media_1788997369962.png)
        if (interaction.customId === 'btn_edit_quantity') {
            const modal = new ModalBuilder()
                .setCustomId('modal_edit_quantity')
                .setTitle('Editar Quantidade');

            const qtyInput = new TextInputBuilder()
                .setCustomId('input_quantity')
                .setLabel('Quantidade (1-999)')
                .setStyle(TextInputStyle.Short)
                .setValue(orderInfo ? orderInfo.quantity.toString() : '1')
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(qtyInput);
            modal.addComponents(row);

            return interaction.showModal(modal);
        }

        // B. Modal Aplicar Cupom (Print 5 - media_1788997384825.png)
        if (interaction.customId === 'btn_use_coupon') {
            const modal = new ModalBuilder()
                .setCustomId('modal_apply_coupon')
                .setTitle('Aplicar Cupom');

            const couponInput = new TextInputBuilder()
                .setCustomId('input_coupon_code')
                .setLabel('Código do cupom')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ex: COD20 ou ARISE10')
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(couponInput);
            modal.addComponents(row);

            return interaction.showModal(modal);
        }

        // C. Adicionar mais produtos
        if (interaction.customId === 'btn_add_product') {
            return interaction.reply({
                content: '💡 Você pode selecionar outros produtos ou planos no menu de vendas principal para adicionar a este atendimento!',
                flags: MessageFlags.Ephemeral
            });
        }

        // D. Ir para Pagamento (Print 1 - media_1788997213710.png)
        if (interaction.customId === 'btn_pay_order') {
            const payRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('pay_pix')
                    .setLabel('Pix')
                    .setEmoji('🟢')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('pay_card')
                    .setLabel('Crédito/Débito')
                    .setEmoji('💳')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('pay_ltc')
                    .setLabel('Litecoin')
                    .setEmoji('🌐')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('pay_btc')
                    .setLabel('Bitcoin')
                    .setEmoji('🟠')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('btn_cancel_order')
                    .setLabel('Cancelar')
                    .setEmoji('🔴')
                    .setStyle(ButtonStyle.Danger)
            );

            return interaction.reply({
                content: `${interaction.user} Selecione uma forma de pagamento`,
                components: [payRow]
            });
        }

        // E. Opções de Pagamento Individuais
        if (interaction.customId === 'pay_pix') {
            await interaction.deferReply();

            const subtotal = orderInfo ? (orderInfo.unitPrice * orderInfo.quantity) : 34.99;
            const discount = (orderInfo && orderInfo.coupon) ? (subtotal * (orderInfo.coupon.discountPercent / 100)) : 0;
            const finalPriceNum = parseFloat((subtotal - discount).toFixed(2));
            const priceStr = finalPriceNum.toFixed(2).replace('.', ',');
            const plan = orderInfo ? `${orderInfo.quantity}x ${orderInfo.planName}` : 'Spoofer Premium';

            try {
                // Criar pagamento via API do Mercado Pago
                const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer APP_USR-7378489083970859-090921-caf3a4cee4f1821d38cea21d4ccef4a1-336912394`,
                        'Content-Type': 'application/json',
                        'X-Idempotency-Key': `arise-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                    },
                    body: JSON.stringify({
                        transaction_amount: finalPriceNum,
                        description: `Arise Protocol - ${plan}`,
                        payment_method_id: 'pix',
                        payer: {
                            email: 'cliente@ariseprotocol.com',
                            first_name: interaction.user.username
                        }
                    })
                });

                const paymentData = await mpResponse.json();

                if (!paymentData || !paymentData.point_of_interaction) {
                    console.error('Erro Mercado Pago:', paymentData);
                    return interaction.editReply({
                        content: '❌ Erro ao gerar o PIX no Mercado Pago. Verifique as credenciais ou tente novamente.'
                    });
                }

                const qrCodeText = paymentData.point_of_interaction.transaction_data.qr_code;
                const qrCodeBase64 = paymentData.point_of_interaction.transaction_data.qr_code_base64;
                const paymentId = paymentData.id;

                // Converter Base64 do QR Code para Buffer do Attachment
                const buffer = Buffer.from(qrCodeBase64, 'base64');
                const qrAttachment = new AttachmentBuilder(buffer, { name: 'qrcode.png' });

                const pixEmbed = new EmbedBuilder()
                    .setTitle('🟢 PAGAMENTO VIA PIX — ARISE PROTOCOL')
                    .setDescription(
                        `📌 **Pedido:** \`${plan}\`\n` +
                        `💰 **Valor Total:** \`R$ ${priceStr}\`\n` +
                        `⏳ **Expira em:** \`15 minutos\`\n\n` +
                        `1. Abra o app do seu banco e escaneie o **QR Code** acima.\n` +
                        `2. Ou clique no botão **"Código Copia e Cola"** abaixo para copiar a chave PIX.\n` +
                        `3. Assim que o pagamento for realizado, **a sua Key será entregue automaticamente aqui no chat!**`
                    )
                    .setImage('attachment://qrcode.png')
                    .setColor('#57F287')
                    .setFooter({ text: `ID do Pedido MP: ${paymentId}` });

                const pixActionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`copy_pix_${paymentId}`)
                        .setLabel('Código Copia e Cola')
                        .setEmoji('📋')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('btn_cancel_order')
                        .setLabel('Cancelar')
                        .setEmoji('🔴')
                        .setStyle(ButtonStyle.Danger)
                );

                // Armazenar o código Pix no mapa global para o botão de copiar
                if (!global.pixMap) global.pixMap = new Map();
                global.pixMap.set(`copy_pix_${paymentId}`, qrCodeText);

                await interaction.editReply({
                    embeds: [pixEmbed],
                    components: [pixActionRow],
                    files: [qrAttachment]
                });

                // Iniciar Verificação Automática do PIX a cada 5 segundos por até 15 minutos
                let attempts = 0;
                const maxAttempts = 180; // 180 * 5s = 15 minutos
                const channel = interaction.channel;
                const buyer = interaction.user;

                const checkInterval = setInterval(async () => {
                    attempts++;
                    try {
                        const checkRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                            headers: {
                                'Authorization': `Bearer APP_USR-7378489083970859-090921-caf3a4cee4f1821d38cea21d4ccef4a1-336912394`
                            }
                        });
                        const checkData = await checkRes.json();

                        if (checkData && checkData.status === 'approved') {
                            clearInterval(checkInterval);

                            // Mapear plano para código do Gerador (1D, 7D, 30D, LIFE)
                            let planCode = '30D';
                            if (orderInfo) {
                                if (orderInfo.planName.includes('1 Dia')) planCode = '1D';
                                else if (orderInfo.planName.includes('7 Dia')) planCode = '7D';
                                else if (orderInfo.planName.includes('30 Dia')) planCode = '30D';
                                else if (orderInfo.planName.includes('LIFETIME')) planCode = 'LIFE';
                            }

                            // Gerar a Key via Google Apps Script API
                            let keyDelivered = 'ARISE-LIFE-3105-26B2';
                            try {
                                const keyRes = await fetch('https://script.google.com/macros/s/AKfycbxRHG_PCB53Vmib757N_Wx3dylVnReWreA_JHcGDN93-CJ_gKzCyqAs3sn7Gbnpl5DLSw/exec', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'text/plain' },
                                    body: JSON.stringify({
                                        action: 'generate_key',
                                        adminSecret: 'AriseAdminSecret_2026_KeyMaster99420',
                                        plan: planCode,
                                        discordId: buyer.id
                                    })
                                });
                                const keyData = await keyRes.json();
                                if (keyData && keyData.success && keyData.key) {
                                    keyDelivered = keyData.key;
                                }
                            } catch (eKey) {
                                console.error('Erro ao gerar key via API:', eKey);
                            }

                            // Embed de Sucesso e Entrega da Key
                            const successEmbed = new EmbedBuilder()
                                .setTitle('🎉 PAGAMENTO CONFIRMADO COM SUCESSO!')
                                .setDescription(
                                    `Obrigado por comprar com o **ARISE PROTOCOL**!\n\n` +
                                    `🔑 **Sua Chave de Licença:**\n` +
                                    `\`\`\`\n${keyDelivered}\n\`\`\`\n` +
                                    `📌 **Plano Adquirido:** \`${plan}\`\n\n` +
                                    `> *Também enviamos uma cópia da sua licença no seu privado (DM)!*`
                                )
                                .setColor('#57F287')
                                .setFooter({ text: 'Arise Spoofer • Entrega Automática' });

                            await channel.send({ content: `${buyer}`, embeds: [successEmbed] });

                            // Enviar por DM também
                            try {
                                await buyer.send({
                                    content: `🎉 **Seu pagamento foi aprovado!** Aqui está sua licença do **Arise Spoofer**:\n\`\`\`\n${keyDelivered}\n\`\`\`\nAproveite!`
                                });
                            } catch (eDm) {}
                        }

                        if (attempts >= maxAttempts) {
                            clearInterval(checkInterval);
                        }
                    } catch (eCheck) {
                        console.error('Erro ao checar pagamento:', eCheck);
                    }
                }, 5000);

            } catch (errPix) {
                console.error('Erro ao processar PIX:', errPix);
                return interaction.editReply({
                    content: '❌ Ocorreu um erro ao conectar com o Mercado Pago.'
                });
            }
        }

        if (interaction.customId.startsWith('copy_pix_')) {
            const code = global.pixMap ? global.pixMap.get(interaction.customId) : null;
            if (code) {
                return interaction.reply({
                    content: `📋 **Código PIX Copia e Cola:**\n\`\`\`\n${code}\n\`\`\``,
                    flags: MessageFlags.Ephemeral
                });
            } else {
                return interaction.reply({
                    content: '❌ Código PIX não encontrado ou expirado.',
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        if (interaction.customId === 'pay_card') {
            const subtotal = orderInfo ? (orderInfo.unitPrice * orderInfo.quantity) : 34.99;
            const discount = (orderInfo && orderInfo.coupon) ? (subtotal * (orderInfo.coupon.discountPercent / 100)) : 0;
            const price = (subtotal - discount).toFixed(2).replace('.', ',');

            const cardEmbed = new EmbedBuilder()
                .setTitle('💳 Pagamento Cartão de Crédito/Débito')
                .setDescription(
                    `💰 **Valor Total:** \`R$ ${price}\`\n\n` +
                    `Solicite o link do checkout via cartão de crédito enviando uma mensagem neste canal para a staff fornecer a fatura segura!`
                )
                .setColor('#2952FF');

            return interaction.reply({ embeds: [cardEmbed], flags: MessageFlags.Ephemeral });
        }

        if (interaction.customId === 'pay_ltc') {
            const ltcEmbed = new EmbedBuilder()
                .setTitle('🌐 Pagamento via Litecoin (LTC)')
                .setDescription(
                    `**Endereço de Carteira LTC:**\n\`Ltc1qAriseProtocolCryptoPaymentWallet999\`\n\n` +
                    `Envie a quantidade equivalente e cole o hash da transação ou print de confirmação neste canal!`
                )
                .setColor('#3498DB');

            return interaction.reply({ embeds: [ltcEmbed], flags: MessageFlags.Ephemeral });
        }

        if (interaction.customId === 'pay_btc') {
            const btcEmbed = new EmbedBuilder()
                .setTitle('🟠 Pagamento via Bitcoin (BTC)')
                .setDescription(
                    `**Endereço de Carteira BTC:**\n\`bc1qAriseProtocolBitcoinPaymentWallet888\`\n\n` +
                    `Envie o valor exato em BTC e cole a hash de confirmação neste canal para aprovação!`
                )
                .setColor('#E67E22');

            return interaction.reply({ embeds: [btcEmbed], flags: MessageFlags.Ephemeral });
        }

        if (interaction.customId === 'btn_cancel_order') {
            try {
                await interaction.reply({ content: '🗑️ Pedido cancelado! Este canal será encerrado em 3 segundos...' });
            } catch(e){}
            setTimeout(async () => {
                try { await interaction.channel.delete(); } catch(e){}
            }, 3000);
            return;
        }
    }

    // --- 4. SELEÇÃO DE CATEGORIA DE TICKETS DE SUPORTE ---
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_category') {
        const user = interaction.user;
        const now = Date.now();
        const COOLDOWN_TIME = 60 * 1000;

        if (cooldowns.has(user.id)) {
            const expirationTime = cooldowns.get(user.id) + COOLDOWN_TIME;
            if (now < expirationTime) {
                const remainingSeconds = Math.ceil((expirationTime - now) / 1000);
                const logoAttachment = new AttachmentBuilder(LOGO_PATH, { name: 'logo.jpg' });
                
                const cooldownEmbed = new EmbedBuilder()
                    .setAuthor({ 
                        name: 'ARISE PROTOCOL! - Sistema de Atendimento',
                        iconURL: 'attachment://logo.jpg'
                    })
                    .setDescription(`❌ | Wow! Você está prestes a quebrar o recorde mundial de abertura de tickets! Deixe-nos dar um respiro de ${remainingSeconds} Segundo(s) para que todos possamos recuperar o fôlego antes da próxima tentativa.`)
                    .setColor('#ED4245');

                return interaction.reply({
                    embeds: [cooldownEmbed],
                    files: [logoAttachment],
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        const logoAttachment = new AttachmentBuilder(LOGO_PATH, { name: 'logo.jpg' });

        const loadingEmbed = new EmbedBuilder()
            .setAuthor({ 
                name: 'ARISE PROTOCOL! - Sistema de Atendimento',
                iconURL: 'attachment://logo.jpg'
            })
            .setDescription('🔄 | Preparando-se para a ação... Conte conosco a cada passo do caminho! 🛠️')
            .setColor('#2952FF');

        try {
            await interaction.reply({ 
                embeds: [loadingEmbed], 
                files: [logoAttachment],
                flags: MessageFlags.Ephemeral 
            });
        } catch (e) {
            console.error('Erro no reply inicial:', e);
            return;
        }

        const val = interaction.values[0];
        let categoryTitle = 'Technical Help';

        if (val === 'cat_compras') { categoryTitle = 'Billing Support'; }
        else if (val === 'cat_suporte') { categoryTitle = 'Technical Help'; }
        else if (val === 'cat_reset_hwid') { categoryTitle = 'Business / Affiliates'; }

        const guild = interaction.guild;
        const cleanUser = user.username.toLowerCase().replace(/[^a-z0-9]/g, '');

        const channelName = `🎫・${cleanUser}`;
        const existingChannel = guild.channels.cache.find(c => c.name === channelName || c.name === `ticket-${cleanUser}`);

        if (existingChannel) {
            const existingEmbed = new EmbedBuilder()
                .setAuthor({ 
                    name: 'ARISE PROTOCOL! - Sistema de Atendimento',
                    iconURL: 'attachment://logo.jpg'
                })
                .setDescription(`⚠️ | Você já possui um ticket aberto em ${existingChannel}!`)
                .setColor('#ED4245');

            const existingLinkRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('🎟️ Ir para o Ticket')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://discord.com/channels/${guild.id}/${existingChannel.id}`)
            );

            return interaction.editReply({
                embeds: [existingEmbed],
                components: [existingLinkRow],
                files: [logoAttachment]
            });
        }

        const parentCategory = interaction.channel.parentId;

        try {
            const ticketChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: parentCategory || undefined,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks
                        ]
                    },
                    {
                        id: client.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ManageChannels
                        ]
                    }
                ]
            });

            cooldowns.set(user.id, now);
            const ticketId = generateTicketId();
            ticketDataMap.set(ticketChannel.id, {
                user: user,
                createdAt: now,
                categoryTitle: categoryTitle,
                claimedBy: null,
                ticketId: ticketId
            });

            const ticketLogo = new AttachmentBuilder(LOGO_PATH, { name: 'logo.jpg' });
            const supportBanner = new AttachmentBuilder(SUPPORT_BANNER_PATH, { name: 'support_banner.jpg' });

            const welcomeEmbed = new EmbedBuilder()
                .setAuthor({ 
                    name: 'ARISE PROTOCOL! #3K - Sistema de Atendimento',
                    iconURL: 'attachment://logo.jpg'
                })
                .setTitle('🔔 | Seja Bem vindo(a) ao seu ticket')
                .setDescription(
                    '# 🛍️ CENTRAL DE ATENDIMENTO – ARISE PROTOCOL\n\n' +
                    '• Para garantir a sua segurança e a entrega imediata dos nossos produtos, todas as solicitações devem ser tratadas exclusivamente através da nossa equipe de atendimento.\n\n' +
                    '# Por que comprar conosco?\n\n' +
                    '• **Entrega Automática**: Receba sua key instantaneamente após a confirmação.\n' +
                    '• **Pagamento Seguro**: Diversas formas de pagamento com proteção de dados.\n' +
                    '• **Preços Atualizados**: Confira promoções e planos vigentes em tempo real.\n\n' +
                    '⚠️ **Aviso: Membros da Staff não solicitam pagamentos via DM. Utilize apenas a nossa plataforma oficial para garantir sua garantia e suporte.**'
                )
                .setColor('#FFFFFF')
                .setImage('attachment://support_banner.jpg')
                .setFooter({ 
                    text: 'Obrigado por escolher nossos serviços. Estamos prontos para ajudar.',
                    iconURL: 'attachment://logo.jpg'
                });

            const actionButtonsRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('fechar_ticket')
                    .setLabel('✖ Fechar Ticket')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('assumir_ticket')
                    .setLabel('✔ Assumir Ticket')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('painel_membro')
                    .setLabel('👤 Painel Membro')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('painel_staff')
                    .setLabel('🎧 Painel Staff')
                    .setStyle(ButtonStyle.Secondary)
            );

            await ticketChannel.send({ 
                content: `${user}`, 
                embeds: [welcomeEmbed], 
                components: [actionButtonsRow],
                files: [ticketLogo, supportBanner]
            });

            const successEmbed = new EmbedBuilder()
                .setAuthor({ 
                    name: 'ARISE PROTOCOL! - Sistema de Atendimento',
                    iconURL: 'attachment://logo.jpg'
                })
                .setDescription('✅ | Ótima notícia! Seu ticket foi criado com sucesso. Estamos prontos para a ação e prontos para resolver tudo! 🌈')
                .setColor('#57F287');

            const linkRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('🎟️ Ir para o Ticket')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://discord.com/channels/${guild.id}/${ticketChannel.id}`)
            );

            await interaction.editReply({
                embeds: [successEmbed],
                components: [linkRow],
                files: [logoAttachment]
            });

        } catch (error) {
            console.error('Erro ao criar ticket:', error);
            const errorEmbed = new EmbedBuilder()
                .setAuthor({ 
                    name: 'ARISE PROTOCOL! - Sistema de Atendimento',
                    iconURL: 'attachment://logo.jpg'
                })
                .setDescription('❌ | Ocorreu um erro ao criar seu ticket. Verifique as permissões do bot no servidor!')
                .setColor('#ED4245');

            await interaction.editReply({
                embeds: [errorEmbed],
                files: [logoAttachment]
            });
        }
    }

    // --- 5. AÇÕES DE BOTÕES DE TICKET (ASSUMIR, PAINÉIS, FECHAR) ---
    if (interaction.isButton()) {
        const ticketInfo = ticketDataMap.get(interaction.channel.id);

        if (interaction.customId === 'assumir_ticket') {
            if (ticketInfo) {
                ticketInfo.claimedBy = interaction.user;
                ticketDataMap.set(interaction.channel.id, ticketInfo);
            }

            try {
                await interaction.reply({
                    content: `✋ O atendente ${interaction.user} assumiu este ticket e responderá em breve!`
                });
            } catch (e) {
                console.error('Erro ao assumir ticket:', e);
            }
        }

        if (interaction.customId === 'painel_membro') {
            try {
                const logoAttachment = new AttachmentBuilder(LOGO_PATH, { name: 'logo.jpg' });
                const memberEmbed = new EmbedBuilder()
                    .setAuthor({ name: 'ARISE PROTOCOL! - Painel do Membro', iconURL: 'attachment://logo.jpg' })
                    .setDescription('👤 | Olá! Você pode anexar comprovantes, prints ou tirar suas dúvidas neste canal.')
                    .setColor('#2952FF');

                await interaction.reply({ embeds: [memberEmbed], files: [logoAttachment], flags: MessageFlags.Ephemeral });
            } catch (e) {}
        }

        if (interaction.customId === 'painel_staff') {
            try {
                const logoAttachment = new AttachmentBuilder(LOGO_PATH, { name: 'logo.jpg' });
                const staffEmbed = new EmbedBuilder()
                    .setAuthor({ name: 'ARISE PROTOCOL! - Painel da Staff', iconURL: 'attachment://logo.jpg' })
                    .setDescription('🎧 | Atendimento em andamento. Verifique se a HWID do cliente precisa de reset ou auxílio técnico.')
                    .setColor('#FEE75C');

                await interaction.reply({ embeds: [staffEmbed], files: [logoAttachment], flags: MessageFlags.Ephemeral });
            } catch (e) {}
        }

        if (interaction.customId === 'fechar_ticket') {
            const reasonMenu = new StringSelectMenuBuilder()
                .setCustomId('confirm_close_ticket')
                .setPlaceholder('📌 Selecione o motivo do encerramento...')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('✅ Atendimento Resolvido / Finalizado')
                        .setDescription('Solicitação ou compra concluída com sucesso')
                        .setValue('Atendimento Resolvido com Sucesso'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('❓ Dúvida Esclarecida')
                        .setDescription('Cliente teve sua dúvida respondida')
                        .setValue('Dúvida Esclarecida'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('❌ Cancelado pelo Cliente')
                        .setDescription('Cliente optou por encerrar')
                        .setValue('Cancelado pelo Cliente'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('⚠️ Inatividade / Sem Resposta')
                        .setDescription('Encerrado por falta de resposta')
                        .setValue('Inatividade')
                );

            const row = new ActionRowBuilder().addComponents(reasonMenu);

            const closeNoticeEmbed = new EmbedBuilder()
                .setAuthor({ name: 'ARISE PROTOCOL! - Finalização de Ticket', iconURL: 'attachment://logo.jpg' })
                .setDescription('🔒 Por favor, selecione abaixo o motivo do encerramento para gerar o relatório e a transcript web do atendimento.')
                .setColor('#FEE75C');

            const logoAttachment = new AttachmentBuilder(LOGO_PATH, { name: 'logo.jpg' });

            try {
                return await interaction.reply({
                    embeds: [closeNoticeEmbed],
                    components: [row],
                    files: [logoAttachment]
                });
            } catch (e) {
                console.error('Erro ao abrir menu de encerramento:', e);
            }
        }
    }

    // --- 6. FECHAMENTO DE TICKET E TRANSCRIPT WEB ---
    if (interaction.isStringSelectMenu() && interaction.customId === 'confirm_close_ticket') {
        const selectedReason = interaction.values[0] || 'Atendimento Resolvido com Sucesso';
        const channel = interaction.channel;
        const closedBy = interaction.user;
        const closedAt = Date.now();

        const ticketInfo = ticketDataMap.get(channel.id) || {
            user: interaction.user,
            createdAt: Date.now() - 30000,
            categoryTitle: 'Technical Help',
            claimedBy: null,
            ticketId: generateTicketId()
        };

        try {
            await interaction.reply({ content: `🔒 Encerrando o ticket com o motivo: **${selectedReason}**... Gerando transcript web em 5 segundos!` });
        } catch (e) {}

        const transcriptFileName = `transcript-${ticketInfo.ticketId}.html`;
        const transcriptFilePath = path.join(TRANSCRIPTS_DIR, transcriptFileName);

        try {
            const htmlAttachment = await discordTranscripts.createTranscript(channel, {
                limit: -1,
                returnType: 'attachment',
                filename: transcriptFileName,
                saveImages: true,
                poweredBy: false
            });
            fs.writeFileSync(transcriptFilePath, htmlAttachment.attachment, 'utf8');
        } catch (transcriptErr) {
            console.error('Erro ao gerar transcript HTML:', transcriptErr);
        }

        const logoAttachment = new AttachmentBuilder(LOGO_PATH, { name: 'logo.jpg' });

        const durationMs = closedAt - ticketInfo.createdAt;
        const durationSec = Math.floor(durationMs / 1000);
        let durationText = `${durationSec} Segundo(s)`;
        if (durationSec >= 60) {
            const min = Math.floor(durationSec / 60);
            const sec = durationSec % 60;
            durationText = `${min} Minuto(s), ${sec} Segundo(s)`;
        }

        const receiptEmbed = new EmbedBuilder()
            .setAuthor({ 
                name: 'ARISE PROTOCOL! #3K – Sistema de Atendimento',
                iconURL: 'attachment://logo.jpg'
            })
            .setTitle('Seu Ticket foi Finalizado!')
            .setColor('#FEE75C')
            .setThumbnail('attachment://logo.jpg')
            .addFields(
                { 
                    name: '🔒 | Fechado Por', 
                    value: `${closedBy} (${closedBy.username} - ${closedBy.id})` 
                },
                { 
                    name: '💼 | Responsável pelo Atendimento', 
                    value: ticketInfo.claimedBy ? `${ticketInfo.claimedBy} (${ticketInfo.claimedBy.username})` : 'Ticket não Assumido 😕' 
                },
                { 
                    name: '❓ | Motivo do Encerramento', 
                    value: `${selectedReason}` 
                },
                { 
                    name: '📁 | Categoria do Ticket', 
                    value: `${ticketInfo.categoryTitle}` 
                },
                { 
                    name: '🆔 | ID do Ticket', 
                    value: `${ticketInfo.ticketId}` 
                },
                { 
                    name: '⏰ | Data de Abertura', 
                    value: `<t:${Math.floor(ticketInfo.createdAt / 1000)}:f>` 
                },
                { 
                    name: '⏰ | Data de Fechamento', 
                    value: `<t:${Math.floor(closedAt / 1000)}:f>` 
                },
                { 
                    name: '⏱️ | Duração do Atendimento', 
                    value: `${durationText}` 
                }
            )
            .setFooter({ text: `${closedBy.username} - ${closedBy.id} • Hoje às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` });

        const transcriptUrl = `http://localhost:3000/transcript/${ticketInfo.ticketId}`;
        const viewTranscriptRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('📝 Ver Transcript Online')
                .setStyle(ButtonStyle.Link)
                .setURL(transcriptUrl)
        );

        try {
            await ticketInfo.user.send({ 
                content: `${ticketInfo.user}`, 
                embeds: [receiptEmbed], 
                components: [viewTranscriptRow],
                files: [logoAttachment] 
            });

            const ratingEmbed = new EmbedBuilder()
                .setDescription('Por favor, avalie nosso atendimento em geral. Sua opinião é importante!')
                .setColor('#57F287')
                .setFooter({ 
                    text: 'Agradecemos por escolher nossos serviços. Obrigado!',
                    iconURL: 'attachment://logo.jpg'
                });

            const ratingSelectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_rating')
                .setPlaceholder('Avaliar Atendimento')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Péssimo')
                        .setEmoji('😒')
                        .setValue('rating_pessimo'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Ruim')
                        .setEmoji('😔')
                        .setValue('rating_ruim'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Regular')
                        .setEmoji('😐')
                        .setValue('rating_regular'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Bom')
                        .setEmoji('😊')
                        .setValue('rating_bom'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Excelente')
                        .setEmoji('🥰')
                        .setValue('rating_excelente')
                );

            const ratingRow = new ActionRowBuilder().addComponents(ratingSelectMenu);
            const ratingLogo = new AttachmentBuilder(LOGO_PATH, { name: 'logo.jpg' });

            await ticketInfo.user.send({
                embeds: [ratingEmbed],
                components: [ratingRow],
                files: [ratingLogo]
            });

        } catch (dmErr) {
            console.log('Não foi possível enviar DM/Avaliação para o usuário (DMs fechadas).');
        }

        try {
            const logsChannel = interaction.guild.channels.cache.find(c => c.name.includes('logs-ticket'));
            if (logsChannel) {
                const logLogo = new AttachmentBuilder(LOGO_PATH, { name: 'logo.jpg' });
                await logsChannel.send({ 
                    embeds: [receiptEmbed], 
                    components: [viewTranscriptRow],
                    files: [logLogo] 
                });
            }
        } catch (logErr) {
            console.error('Erro ao enviar log:', logErr);
        }

        setTimeout(async () => {
            try {
                await channel.delete();
            } catch (e) {
                console.error('Erro ao deletar canal:', e);
            }
        }, 5000);
    }

    // --- 7. AVALIAÇÃO DE ATENDIMENTO NA DM ---
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_rating') {
        const ratingVal = interaction.values[0];
        let replyMsg = 'Agradecemos sua avaliação!';

        if (ratingVal === 'rating_excelente') {
            replyMsg = '❤️ | Uau! Estamos honrados com sua avaliação máxima para nosso atendimento. Muito obrigado!';
        } else if (ratingVal === 'rating_bom') {
            replyMsg = '😊 | Ficamos felizes em ajudar! Muito obrigado pela sua avaliação positiva.';
        } else if (ratingVal === 'rating_regular') {
            replyMsg = '😐 | Agradecemos o seu feedback! Vamos buscar melhorar continuamente nosso suporte.';
        } else if (ratingVal === 'rating_ruim') {
            replyMsg = '😔 | Lamento que sua experiência não tenha sido ideal. Vamos analisar seu caso para evoluir.';
        } else if (ratingVal === 'rating_pessimo') {
            replyMsg = '💔 | Pedimos desculpas pelo transtorno. Sua avaliação foi registrada e será repassada à diretoria.';
        }

        try {
            await interaction.reply({ content: replyMsg });

            setTimeout(async () => {
                try {
                    await interaction.deleteReply();
                } catch (e) {}
            }, 5000);

            const logsChannel = interaction.guild?.channels.cache.find(c => c.name.includes('logs-ticket'));
            if (logsChannel) {
                const ratingLogEmbed = new EmbedBuilder()
                    .setTitle('⭐ Nova Avaliação de Atendimento')
                    .setDescription(`**Cliente:** ${interaction.user} (${interaction.user.tag})\n**Avaliação:** \`${ratingVal.replace('rating_', '').toUpperCase()}\`\n**Mensagem de Resposta:** ${replyMsg}`)
                    .setColor('#57F287');
                await logsChannel.send({ embeds: [ratingLogEmbed] });
            }
        } catch (e) {
            console.error('Erro ao responder avaliação:', e);
        }
    }
});

client.login(TOKEN).catch(err => {
    console.error('❌ ERRO AO CONECTAR O BOT:', err.message);
});
