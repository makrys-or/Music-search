/**
 * вк плейлист
 *
 * вставь в консоль браузера на странице vk.com и скрипт сам разберётся что качать.
 *
 * работает на трёх типах страниц:
 *   - /audios123456                           — вся музыка пользователя
 *   - /audios123456?z=audio_playlist123_456   — плейлист, открытый на странице музыки
 *   - /music/playlist/123_456_key             — прямая ссылка на плейлист
 *
 * или вручную:
 *   downloadPlaylistTxt("ownerid_playlistid_accesskey")
 *   downloadUserMusicTxt(userId)
 */


// скачать треки плейлиста по его id
async function downloadPlaylistTxt(rawPlaylistId) {
    const clean = rawPlaylistId.replace('audio_playlist', '').replace('playlist_', '');
    const parts = clean.split('_');
    const ownerId = parseInt(parts[0]);
    const playlistId = parseInt(parts[1]);
    const accessKey = parts.slice(2).join('_') || '';

    try {
        const metaResp = await window.vkApi.api('audio.getPlaylistById', {
            playlist_id: playlistId,
            owner_id: ownerId,
            access_key: accessKey,
            extra_fields: 'owner,duration'
        });

        if (!metaResp || !metaResp.playlist) {
            console.error('плейлист не найден');
            return;
        }

        const playlistTitle = metaResp.playlist.title || 'playlist';

        const sourceResp = await window.vkApi.api('audio.getAudioIdsBySource', {
            source: 'playlist',
            entity_id: `${ownerId}_${playlistId}${accessKey ? '_' + accessKey : ''}`
        });

        const audioIds = sourceResp?.audios || [];

        if (audioIds.length === 0) {
            console.error('плейлист пуст или нет доступа');
            return;
        }

        const allTracks = await fetchTracksByIds(audioIds);
        saveTxt(playlistTitle, allTracks);

    } catch (e) {
        console.error('ошибка:', e);
    }
}


// скачать всю музыку пользователя по его числовому id
async function downloadUserMusicTxt(userId) {
    try {
        const allTracks = [];
        const pageSize = 200;
        let offset = 0;
        let total = null;

        do {
            const resp = await window.vkApi.api('audio.get', {
                owner_id: userId,
                count: pageSize,
                offset: offset
            });

            if (!resp || !resp.items) {
                console.error('не удалось получить музыку');
                return;
            }

            if (total === null) total = resp.count;
            allTracks.push(...resp.items);
            offset += pageSize;
            console.log(`загружено ${allTracks.length} / ${total}...`);

        } while (offset < total);

        const userName = document.querySelector('.ProfileHeader__name, .profile_name, h1')?.innerText?.trim() || `audios${userId}`;
        saveTxt(userName, allTracks);

    } catch (e) {
        // audio.get может быть недоступен через vkApi — пробуем через ajax
        try {
            await downloadUserMusicViaAjax(userId);
        } catch (e2) {
            console.error('ошибка:', e2);
        }
    }
}


// fallback через ajax если vkApi.audio.get не работает
async function downloadUserMusicViaAjax(userId) {
    const allTracks = [];
    const pageSize = 200;
    let offset = 0;
    let total = null;

    do {
        const resp = await fetch('/al_audio.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                act: 'load_section',
                owner_id: userId,
                playlist_id: -1,
                offset: offset,
                type: 'playlist',
                al: 1
            })
        });

        const text = await resp.text();
        // VK возвращает ответ в формате <!--{json}-->
        const match = text.match(/<!--(.+)-->/s);
        if (!match) break;

        const data = JSON.parse(match[1]);
        const payload = data?.payload?.[1]?.[0];
        if (!payload) break;

        const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
        if (!parsed?.list) break;

        if (total === null) total = parsed.totalCount || parsed.list.length;

        for (const item of parsed.list) {
            // формат: [id, owner_id, url, artist, title, ...]
            if (Array.isArray(item) && item.length >= 5) {
                allTracks.push({ artist: item[4], title: item[3] });
            }
        }

        offset += pageSize;

    } while (offset < total);

    if (allTracks.length === 0) {
        console.error('не удалось получить треки через ajax');
        return;
    }

    const userName = document.querySelector('.ProfileHeader__name, .profile_name, h1')?.innerText?.trim() || `audios${userId}`;
    saveTxt(userName, allTracks);
}


// загрузить треки по массиву id (для плейлистов)
async function fetchTracksByIds(audioIds) {
    const allTracks = [];
    const chunkSize = 100;
    console.log(`получено id треков: ${audioIds.length}, начинаем загрузку...`);
    for (let i = 0; i < audioIds.length; i += chunkSize) {
        const chunk = audioIds.slice(i, i + chunkSize);
        const ids = chunk.map(t => t.audio_id || t).join(',');
        try {
            const resp = await window.vkApi.api('audio.getById', { audios: ids });
            if (Array.isArray(resp)) allTracks.push(...resp);
        } catch (e) {
            console.error('ошибка при загрузке треков:', e);
        }
        console.log(`загружено ${Math.min(i + chunkSize, audioIds.length)} / ${audioIds.length}...`);
    }
    return allTracks;
}


// сформировать и скачать .txt файл
function saveTxt(title, tracks) {
    console.log(`готово, треков: ${tracks.length}. сохраняем файл...`);
    const lines = tracks.map(track => {
        const artist = track.artist || '';
        const name = track.title || '';
        const subtitle = track.subtitle ? ` (${track.subtitle})` : '';
        return `${artist} — ${name}${subtitle}`;
    });

    const text = `${title}\n${'^'.repeat(title.length)}\n\n${lines.join('\n')}`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}


// автоопределение по текущему URL
async function autoDetectAndDownload() {
    const params = new URLSearchParams(window.location.search);
    const z = params.get('z') || '';
    const path = window.location.pathname;

    // /music/playlist/ownerid_id_key
    const playlistPathMatch = path.match(/\/music\/playlist\/(.+)/);
    if (playlistPathMatch) {
        return await downloadPlaylistTxt(playlistPathMatch[1]);
    }

    // ?z=audio_playlist...
    if (z.startsWith('audio_playlist')) {
        return await downloadPlaylistTxt(z.replace('audio_playlist', ''));
    }

    // /audiosXXXXXX — вся музыка пользователя
    const audiosMatch = path.match(/\/audios(-?\d+)/);
    if (audiosMatch) {
        return await downloadUserMusicTxt(parseInt(audiosMatch[1]));
    }

    console.error('не удалось определить что качать. используй downloadPlaylistTxt("id") или downloadUserMusicTxt(userId) вручную');
}


autoDetectAndDownload();
