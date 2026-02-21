Docepo - aplikacja wspomagająca prowadzenie bieżących zajęć.

Ma służyć nauczycielowi akademickiemu do bieżącego prowadzenia zajęć. Zakłada, że wcześniej prowadzący przygotował podział studentów na rozłączne grupy, dla każdej grupy przygotowane są terminy zajęć.
Podobnie przygotował zadania, ich punktację itp.
Początkowa wersja zakłada użycie w interfejsie użytkownika języka polskiego, natomiast w kodzie - języka angielskiego do identyfikatorów.

Aplikacja ma być głównie używana na komórce. Ostateczne dane będą pobierane z moodle poprzez odpowiednie api. Początkowo będzie to symulowane przez serwis moodle.servis.ts
Będzie głównie odczytywać dane potrzebne do prezentacji w panelach. 

Bieżące zajęcia - termin zajęć (dla danej grupy w ramach danego kursu zalogowane użytkownika) przypada na obecny czas zegarowy plus/minus 15 minut.

Obecności - funkcjonalności.

Jeśli chodzi o modyfikację obecności, to aplikacja będzie modyfikować tylko stan obecności danego studenta. Będzie to tylko możliwe dla bieżących zajęć. Dane które będą zmieniane to obecność studenta na bieżących zajęciach.
Będą też odczytywane wszystkie terminy zajęć danej grupy, do której student należy, aby zaprezentować je w sposób graficzny w panelu studenta.

Panel listy obecności.

U góry dane o prowadzącym, kursie, grupie i terminie zajęć.
Poniżej posortowana w/g nazwisk i imion lista studentów. Te dane po lewej stronie (z numerem porządkowym), a po prawej okrągłe przyciski P/A/L do pamiętania stanu obecności (present/absent/late) działające jak on/off radiobutton-y, ale z możliwością odznaczenia.

Zadania i rozwiązania.

Do modelu dołożymy teraz zadanie (Task). Ma mieć id, nazwę (najczęściej postaci Lnn, gdzie nn to dwie cyfry), opis, maksymalną liczbę punktów (najczęściej 50 lub 100, to będzie w danych do testów). Inna klasa to Rozwiązanie (Solution), które oznacza realizację przez danego studenta danego zadania. Rozwiązanie zatem posiada id, id studenta, id zadania, datę wykonania, liczbę punktów (od zera do maksymalnej za dane zadanie), datę, komentarz, oraz stan. Pusty stan to inaczej jeszcze nie ocenione zadanie (znak minus), z komentarzem (C - comment) co trzeba poprawić, ocenione zadanie (G - graded), z ostrzeżeniem w komentarzu (W - warning), z wgranym rozwiązaniem na ePortal (U - uploaded), zakończone pozytywnie (P - positive), zakończone negatywnie (N - negative). Trzebaby zatem dla testowania przygotowac w serwisie moodle kilka zadań, a potem dla bieżącej grupy dla wszystkich studentów rozwiązania.


Używaj nowszych mechanizmów z Angular 21 (signal, funkcji input() itp.)

do przechowywania danych używaj @capacitor/preferences

do routingu używać adresów url z parametrami, nigdy nie używać stosu historii przeglądarki.

Aplikacja ma być raczej szybka niż z animacjami. Animacje są tam gdzie to rzeczywiście daje poczucie dodatkowej informacji, jak przesuwanie listu studentów w górę/dół na panelu obecności. 

Zrobić "Deep Scan".

dobry LLM - Claude Haiki 4.5

