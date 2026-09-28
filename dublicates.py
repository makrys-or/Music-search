class Song:
    def __init__(self, artist, title):
        self.title = title.capitalize().strip()
        self.artist = artist.capitalize().strip()

songs = []

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

duplicates = {}

for song in songs:
    key = (song.artist, song.title)
    if key not in duplicates:
        duplicates[key] = []
    duplicates[key].append(song)   

for key, songs in duplicates.items():

    if len(songs) > 1:
        print(f"Дубликат: {key}")
        print(f"Количество: {len(songs)}")
        print()