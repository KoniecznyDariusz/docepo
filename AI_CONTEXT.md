Docepo - aplikacja wspomagająca prowadzenie bieżących zajęć.

Ma służyć nauczycielowi akademickiemu do bieżącego prowadzenia zajęć. Zakłada, że wcześniej prowadzący przygotował podział studentów na rozłączne grupy, dla każdej grupy przygotowane są terminy zajęć.
Podobnie przygotował zadania, ich punktację itp.

Aplikacja ma być głównie używana na komórce. Ostateczne dane będą pobierane z moodle poprzez odpowiednie api. Początkowo będzie to symulowane przez serwis moodle.servis.ts
Będzie głównie odczytywać dane potrzebne do prezentacji w panelach. 

Bieżące zajęcia - termin zajęć (dla danej grupy w ramach danego kursu zalogowane użytkownika) przypada na obecny czas zegarowy plus/minus 15 minut.

Obecności - funkcjonalności.

Jeśli chodzi o modyfikację obecności, to aplikacja będzie modyfikować tylko stan obecności danego studenta. Będzie to tylko możliwe dla bieżących zajęć. Dane które będą zmieniane to obecność studenta na bieżących zajęciach.
Będą też odczytywane wszystkie terminy zajęć danej grupy, do której student należy, aby zaprezentować je w sposób graficzny w panelu studenta.



Używaj nowszych mechanizmów z Angular 21 (signal, funkcji input() itp.)

do przechowywania danych używaj @capacitor/preferences

do routingu używać adresów url z parametrami, nigdy nie używać stosu historii przeglądarki.

Zrobić "Deep Scan".

dobry LLM - Claude Haiki 4.5