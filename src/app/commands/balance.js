const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const ComponentState = require('../components/ComponentState');
const { cfg } = require('../../cfg');

const commands = [
	{
		data: new SlashCommandBuilder()
			.setName('balance')
			.setDescription('Проверка баланса пользователя')
			.addUserOption(option => option.setName('пользователь').setDescription('Пользователь').setRequired(false)),

		async execute(interaction, client, dbUser) {
			const target = interaction.options.getUser('пользователь') || interaction.user;
			const { spawn } = require('child_process');
			const path = require('path');

			const Users = client.schemas.get('Users');
			const Donate = client.schemas.get('Donate');

			let [userData, donateData] = await Promise.all([
				Users.findOne({ user_id: target.id }),
				Donate.findOne({ user_id: target.id })
			]);

			if (!userData) userData = await Users.create({ user_id: target.id, status: 'Не установлен' });
			if (!donateData) donateData = await Donate.create({ user_id: target.id, donate: 0 });

			// Analytics for current month
			const now = new Date();
			const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
			const monthStartTs = Math.floor(monthStart.getTime() / 1000);
			const tx = Array.isArray(userData.transactions) ? userData.transactions : [];
			const monthTx = tx.filter(t => (t?.date || 0) >= monthStartTs);
			const spentMonth = monthTx.filter(t => t.type === 'give').reduce((s, t) => s + (t.amount || 0), 0);
			const earnedMonth = monthTx.filter(t => t.type === 'take').reduce((s, t) => s + (t.amount || 0), 0);

			const lastTx = [...tx]
				.sort((a, b) => (b.date || 0) - (a.date || 0))
				.slice(0, 4)
				.map(t => ({ member: t.member, type: t.type, amount: t.amount, date: t.date, description: t.description }));

			const payload = {
				coins: userData.balance || 0,
				donate: donateData.donate || 0,
				transactions: lastTx,
				analytics: {
					spent_month: spentMonth,
					earned_month: earnedMonth,
					total_month: earnedMonth - spentMonth
				}
			};

			await interaction.deferReply();

			const python = spawn('python', [path.join(__dirname, '../utils/balance_profile.py')]);
			let result = ''; let error = '';
			python.stdout.on('data', d => { result += d.toString(); });
			python.stderr.on('data', d => { error += d.toString(); console.error('Python error:', d.toString()); });
			python.stdin.write(JSON.stringify(payload));
			python.stdin.end();
			await new Promise((res, rej) => python.on('close', c => c === 0 ? res() : rej(new Error(`python exited ${c}: ${error}`))));

			const base64Image = result.trim();
			if (!base64Image || base64Image === 'None') return interaction.editReply({ content: 'Не удалось сгенерировать изображение баланса.' });
			const imageBuffer = Buffer.from(base64Image, 'base64');
			await interaction.editReply({ files: [{ attachment: imageBuffer, name: 'bank.png' }] });
		}
	},
	{
		data: new SlashCommandBuilder()
			.setName('give')
			.setDescription('Передача монет другому пользователю')
			.addUserOption(option => option.setName('пользователь').setDescription('Выберите пользователя').setRequired(true))
			.addIntegerOption(option => option.setName('сумма').setDescription('Количество монет').setRequired(true)),

		async execute(interaction, client, dbUser) {
			const user = interaction.options.getUser('пользователь');
			const author = interaction.user;
			const amount = interaction.options.getInteger('сумма');
			const minAmount = 10; // Минимальная сумма перевода

			if (amount <= 0) {
				return interaction.reply({
					embeds: [{
						title: '❌ Ошибка перевода',
						description: 'Сумма перевода должна быть положительным числом!',
						color: 0xFF0000,
						thumbnail: {
							url: author.displayAvatarURL({ size: 128 })
						},
						timestamp: new Date().toISOString()
					}],
					ephemeral: true
				});
			}

			if (amount < minAmount) {
				return interaction.reply({
					embeds: [{
						title: 'Ошибка перевода',
						description: `Минимальная сумма перевода составляет **${minAmount}** монет.`,
						color: 0x000000,
						thumbnail: {
							url: author.displayAvatarURL({ size: 128 })
						},
						timestamp: new Date().toISOString()
					}]
				});
			}

			if (user.id === author.id) {
				return interaction.reply({
					embeds: [{
						title: '❌ Ошибка перевода',
						description: 'Вы не можете передать монеты самому себе!',
						color: 0xFF0000,
						thumbnail: {
							url: author.displayAvatarURL({ size: 128 })
						},
						timestamp: new Date().toISOString()
					}],
					ephemeral: true
				});
			}

			const Users = client.schemas.get('Users');
			const userData = await Users.findOne({ user_id: user.id });
			const authorData = await Users.findOne({ user_id: author.id });
			const commision = 0.05; // 5% комиссия
			const commisionAmount = amount - Math.ceil(amount * commision);

			if (authorData.balance < commisionAmount) {
				const embed = {
					title: `Недостаточно средств!`,
					description: `<@${author.id}>, У вас **недостаточно средств**. Не хватает **${commisionAmount - authorData.balance}** ${client.emojis.zvezda}.`,
					color: 0x000000,
					thumbnail: {
						url: author.displayAvatarURL({ size: 128 })
					},
					timestamp: new Date().toISOString()
				}
				return await interaction.reply({ embeds: [embed] });
			}

			const embed = {
				title: `Передача монет`,
				description: `<@${author.id}>, Вы **уверены**, что хотите передать **${commisionAmount}** ${client.emojis.zvezda}, включая комиссию 5% пользователю <@${user.id}>?`,
				color: 0x000000,
				fields: [
					{ name: 'Сумма перевода', value: `${amount} монет`, inline: true },
					{ name: 'Комиссия', value: `5%`, inline: true },
					{ name: 'Итоговая сумма', value: `${commisionAmount} монет`, inline: true }
				],
				thumbnail: {
					url: author.displayAvatarURL({ size: 128 })
				},
				timestamp: new Date().toISOString()
			}

			const msg = await interaction.reply({ embeds: [embed] });

			const states = ComponentState.createMany(['confirm_give', 'cancel_give'], {
				user: user,
				author: author,
				amount: commisionAmount,
				sAmount: amount,
				msg: msg
			});

			const confirmButton = new ButtonBuilder()
				.setCustomId(states.confirm_give)
				.setLabel('Подтвердить')
				.setStyle(ButtonStyle.Success)
				.setEmoji('✅');

			const cancelButton = new ButtonBuilder()
				.setCustomId(states.cancel_give)
				.setLabel('Отмена')
				.setStyle(ButtonStyle.Danger)
				.setEmoji('❌');

			const row = new ActionRowBuilder()
				.addComponents(confirmButton, cancelButton);

			await msg.edit({ components: [row] });
		}
	},
	{
		data: new SlashCommandBuilder()
			.setName('timely')
			.setDescription('Выдача ежедневной награды'),
		async execute(interaction, client, dbUser) {
			const Users = client.schemas.get('Users');

			if (!dbUser.canGetTimely) {
				return interaction.reply({
					embeds: [{
						title: '⏰ Награда еще не доступна',
						description: `Следующая награда будет доступна через <t:${dbUser.nextTimely}:R>`,
						color: 0x000000,
						thumbnail: {
							url: interaction.user.displayAvatarURL({ size: 128 })
						},
						timestamp: new Date().toISOString()
					}]
				})
			}

			await Users.updateOne(
				{ user_id: interaction.user.id },
				{
					$inc: { balance: cfg.timely },
					$set: {
						'cooldowns.timely': Math.floor(Date.now() / 1000)
					}
				}
			);

			const embed = {
				title: '💰 Ежедневные награды',
				description: `Вы получили **${cfg.timely}** ${client.emojis.zvezda}\nСледующая награда будет доступна <t:${Math.floor(Date.now() / 1000) + (12 * 60 * 60)}:R>`,
				color: 0x000000,
				thumbnail: {
					url: interaction.user.displayAvatarURL({ size: 128 })
				},
				timestamp: new Date().toISOString()
			}

			await interaction.reply({ embeds: [embed] });

		}
	}
]

module.exports = commands;