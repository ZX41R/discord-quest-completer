(() => {
	"use strict";

	const log   = (msg) => console.log(`%c[Quest]%c ${msg}`, "color:#5865F2;font-weight:bold", "color:inherit");
	const warn  = (msg) => console.warn(`%c[Quest]%c ${msg}`, "color:#FEE75C;font-weight:bold", "color:inherit");
	const error = (msg) => console.error(`%c[Quest]%c ${msg}`, "color:#ED4245;font-weight:bold", "color:inherit");

	if (typeof DiscordNative === "undefined") {
		error("Must be run inside Discord Desktop app.");
		return;
	}

	delete window.$;
	const wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
	webpackChunkdiscord_app.pop();

	const findModule   = (filter) => Object.values(wpRequire.c).find(filter);
	const findExport   = (filter, key) => findModule(filter)?.exports?.[key];

	const resolveStore = (pk, fk, matcher) =>
		findExport(x => x?.exports?.[pk]?.[matcher], pk)
		?? findExport(x => x?.exports?.[fk]?.[matcher], fk);

	const resolveProtoStore = (pk, fk, matcher) =>
		findExport(x => x?.exports?.[pk]?.__proto__?.[matcher], pk)
		?? findExport(x => x?.exports?.[fk]?.__proto__?.[matcher], fk);

	const RunningGameStore  = resolveStore("ZP", "Ay", "getRunningGames");
	const QuestsStore       = resolveProtoStore("Z", "A", "getQuest");
	const ChannelStore      = resolveProtoStore("Z", "A", "getAllThreadsForParent");
	const GuildChannelStore = resolveStore("ZP", "Ay", "getSFWDefaultChannel");
	const FluxDispatcher    = resolveProtoStore("Z", "h", "flushWaitQueue");
	const api               = findExport(x => x?.exports?.tn?.get, "tn")
	                       ?? findExport(x => x?.exports?.Bo?.get, "Bo");

	if (!RunningGameStore || !QuestsStore || !FluxDispatcher || !api) {
		error("Failed to resolve Discord internals. Discord may have updated.");
		return;
	}

	const SUPPORTED_TASKS = ["PLAY_ON_DESKTOP", "PLAY_ACTIVITY"];

	const getTaskName = (quest) => {
		const tasks = (quest.config.taskConfig ?? quest.config.taskConfigV2).tasks;
		return SUPPORTED_TASKS.find(t => tasks[t] != null);
	};

	const pendingQuests = [...QuestsStore.quests.values()].filter(quest => {
		const enrolled   = quest.userStatus?.enrolledAt;
		const completed  = quest.userStatus?.completedAt;
		const notExpired = new Date(quest.config.expiresAt).getTime() > Date.now();
		return enrolled && !completed && notExpired && getTaskName(quest);
	});

	if (pendingQuests.length === 0) {
		warn("No uncompleted game-play quests found.");
		return;
	}

	log(`Found ${pendingQuests.length} pending quest(s). Starting...`);

	const sleep      = (ms) => new Promise(r => setTimeout(r, ms));
	const randomPid  = () => Math.floor(Math.random() * 30000) + 1000;
	const formatTime = (s) => {
		const m = Math.ceil(s / 60);
		return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
	};

	async function handleDesktop(quest, taskConfig, next) {
		const appId   = quest.config.application.id;
		const appName = quest.config.application.name;
		const needed  = taskConfig.tasks.PLAY_ON_DESKTOP.target;
		const done    = quest.userStatus?.progress?.PLAY_ON_DESKTOP?.value ?? 0;
		const pid     = randomPid();

		const res     = await api.get({ url: `/applications/public?application_ids=${appId}` });
		const appData = res.body[0];

		if (!appData?.executables?.length) {
			error(`No executable data for "${appName}".`);
			return next();
		}

		const exe = appData.executables.find(x => x.os === "win32");
		if (!exe) {
			error(`No win32 executable for "${appName}".`);
			return next();
		}

		const exeName  = exe.name.replace(">", "");
		const fakeGame = {
			cmdLine:     `C:\\Program Files\\${appData.name}\\${exeName}`,
			exeName,
			exePath:     `c:/program files/${appData.name.toLowerCase()}/${exeName}`,
			hidden:      false,
			isLauncher:  false,
			id:          appId,
			name:        appData.name,
			pid,
			pidPath:     [pid],
			processName: appData.name,
			start:       Date.now(),
		};

		const origGetGames    = RunningGameStore.getRunningGames;
		const origGetByPid    = RunningGameStore.getGameForPID;
		const origGames       = origGetGames();
		const spoofed         = [fakeGame];

		RunningGameStore.getRunningGames = () => spoofed;
		RunningGameStore.getGameForPID   = (p) => spoofed.find(g => g.pid === p);

		FluxDispatcher.dispatch({
			type: "RUNNING_GAMES_CHANGE",
			removed: origGames, added: [fakeGame], games: spoofed,
		});

		log(`Spoofed → "${appName}" | ETA: ${formatTime(needed - done)}`);

		const handler = (data) => {
			const progress = quest.config.configVersion === 1
				? data.userStatus.streamProgressSeconds
				: Math.floor(data.userStatus.progress.PLAY_ON_DESKTOP.value);

			log(`Progress: ${progress}s / ${needed}s (${Math.min(100, Math.round((progress / needed) * 100))}%)`);

			if (progress >= needed) {
				log(` "${quest.config.messages.questName}" completed!`);
				RunningGameStore.getRunningGames = origGetGames;
				RunningGameStore.getGameForPID   = origGetByPid;
				FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: [fakeGame], added: [], games: [] });
				FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", handler);
				next();
			}
		};

		FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", handler);
	}

	async function handleActivity(quest, taskConfig, next) {
		const name   = quest.config.messages.questName;
		const needed = taskConfig.tasks.PLAY_ACTIVITY.target;
		const done   = quest.userStatus?.progress?.PLAY_ACTIVITY?.value ?? 0;

		const channelId = ChannelStore.getSortedPrivateChannels()[0]?.id
			?? Object.values(GuildChannelStore.getAllGuilds())
				.find(g => g?.VOCAL?.length > 0)?.VOCAL[0]?.channel?.id;

		if (!channelId) {
			error("No voice channel available for activity heartbeat.");
			return next();
		}

		const streamKey = `call:${channelId}:1`;
		log(`Activity quest "${name}" | ETA: ${formatTime(needed - done)}`);

		while (true) {
			const res      = await api.post({ url: `/quests/${quest.id}/heartbeat`, body: { stream_key: streamKey, terminal: false } });
			const progress = res.body.progress.PLAY_ACTIVITY.value;
			log(`Progress: ${progress}s / ${needed}s (${Math.min(100, Math.round((progress / needed) * 100))}%)`);
			if (progress >= needed) {
				await api.post({ url: `/quests/${quest.id}/heartbeat`, body: { stream_key: streamKey, terminal: true } });
				break;
			}
			await sleep(20_000);
		}

		log(` "${name}" completed!`);
		next();
	}

	const queue = [...pendingQuests];

	function processNext() {
		const quest = queue.pop();
		if (!quest) return log(" All quests processed!");

		const taskConfig = quest.config.taskConfig ?? quest.config.taskConfigV2;
		const taskName   = getTaskName(quest);

		log(`── Processing: "${quest.config.messages.questName}" (${taskName}) ──`);

		if (taskName === "PLAY_ON_DESKTOP") handleDesktop(quest, taskConfig, processNext);
		else if (taskName === "PLAY_ACTIVITY") handleActivity(quest, taskConfig, processNext);
	}

	processNext();
})();
