class Song:
    def __init__(self, artist, title):
        self.title = title.capitalize().strip()
        self.artist = artist.capitalize().strip()

songs = []
table = {}

with open("tracks.txt", "r", encoding="utf-8-sig") as file:
    for line_number, line in enumerate(file, start=1):
        line = line.strip()
        if not line:
            continue

        if " - Трек " in line:  # Для Яндекса
            artist, title = line.split(" - Трек ", 1)
        elif " — " in line:  # Для ВК
            artist, title = line.split(" — ", 1)
        else:
            print(f"Пропуск строки {line_number}: не найден разделитель: {line}")
            continue

        songs.append(Song(artist, title))

for song in songs:
    key = (song.artist)
    if key not in table:
        table[key] = []
    table[key].append(song.title) 

key, value = max(table.items(), key=lambda item: len(item[1]))

top_3 = sorted(table.items(), key=lambda item: len(item[1]), reverse=True)[:10]

for key, value in top_3:
    print(key, "-", len(value))

