## Docepo – kontekst projektu dla AI

### 1) Cel aplikacji
Docepo to aplikacja wspomagająca nauczyciela akademickiego w bieżącym prowadzeniu zajęć.

Założenia domenowe:
- prowadzący ma wcześniej przygotowane kursy, grupy i terminy zajęć
- przygotowane są zadania i ich punktacja
- aplikacja wspiera głównie odczyt danych i szybkie zmiany stanu obecności
- interfejs użytkownika: język polski
- kod i identyfikatory techniczne: język angielski

### 2) Platforma i źródła danych
- Priorytet: użycie mobilne (telefon).
- Źródło danych docelowo: Moodle API.
- Na etapie developmentu dane są symulowane przez `moodle.service.ts`.

### 3) Definicja „bieżących zajęć”
„Bieżące zajęcia” to termin zajęć dla danej grupy (w ramach kursu zalogowanego użytkownika),
którego czas przypada w oknie:
`start zajęć - 5 minut <= teraz <= end zajęć + 15 minut`.

Czyli system bazuje na danych Moodle (`start`, `end`) i rozszerza okno aktywności o 5 minut
przed startem oraz 15 minut po zakończeniu zajęć.

### 4) Obecności – zakres funkcjonalny
- Możliwa jest wyłącznie modyfikacja stanu obecności studenta.
- Modyfikacja jest dozwolona tylko dla bieżących zajęć.
- Odczyt obejmuje też wszystkie terminy zajęć grupy, aby pokazać kontekst historyczny w panelu studenta.

#### Panel listy obecności
- Górna sekcja: prowadzący, kurs, grupa, termin zajęć.
- Lista studentów: sortowanie po nazwisku i imieniu.
- Po lewej: numer porządkowy + dane studenta.
- Po prawej: okrągłe przełączniki P/A/L (Present/Absent/Late), działające jak radio z możliwością odznaczenia.

### 5) Zadania i rozwiązania
#### Task
Encja `Task` zawiera:
- `id`,
- `name` (najczęściej format `Lnn`, np. `L01`),
- `description`,
- `maxPoints` (najczęściej 50 lub 100 w danych testowych).

#### Solution
Encja `Solution` oznacza realizację zadania przez studenta i zawiera:
- `id`,
- `studentId`,
- `taskId`,
- `submissionDate`,
- `points` (0..`maxPoints`),
- `comment`,
- `status`.

Statusy `Solution`:
- `-` = jeszcze nieocenione,
- `C` = comment (co poprawić),
- `G` = graded,
- `W` = warning,
- `U` = uploaded,
- `P` = positive,
- `N` = negative.

W danych testowych w `moodle.service.ts` przygotować:
- kilka zadań (`Task`),
- dla bieżącej grupy rozwiązania (`Solution`) dla wszystkich studentów.

### 6) Wytyczne techniczne
- Angular 21+: używaj nowoczesnych mechanizmów (`signals`, `input()`, `computed()`, `effect()`, nowy control flow).
- Trwałe przechowywanie danych: `@capacitor/preferences`.
- Routing: przekazuj stan przez adresy URL i parametry tras; nie opieraj logiki na stosie historii przeglądarki.

### 7) UX i wydajność
- Priorytet: szybkość i czytelność, nie animacje.
- Animacje tylko tam, gdzie realnie wzmacniają informację (np. przesuwanie listy studentów).

### 8) Zasady pracy AI w tym repo
- Proponuj minimalne, konkretne zmiany zgodne z aktualną architekturą.
- Nie zmieniaj nazw i struktury modułów bez wyraźnej potrzeby.
- Dla nowych funkcji najpierw aktualizuj modele i serwisy danych, potem panele UI.
- W rozwiązaniach uwzględniaj „Deep Scan” (analiza wpływu na routing, modele, serwisy i panele).

### 9) Starter prompt (do wklejenia na start sesji)
Skopiuj poniższy szablon i uzupełnij sekcję „Zadanie”.

```text
Pracujesz w projekcie Docepo (Angular 21 + Capacitor, mobile-first).

Kontekst domenowy:
- Aplikacja dla nauczyciela akademickiego do bieżącego prowadzenia zajęć.
- UI po polsku, kod po angielsku.
- Dane docelowo z Moodle API, lokalnie symulowane w `moodle.service.ts`.
- Bieżące zajęcia: termin w oknie `start zajęć - 15 min <= teraz <= end zajęć + 15 min`.

Wymagania techniczne:
- Używaj nowoczesnego Angulara (signals, input(), computed(), effect(), nowy control flow).
- Trwałe dane zapisuj przez `@capacitor/preferences`.
- Routing opieraj na URL i parametrach tras; nie opieraj logiki na historii przeglądarki.
- Preferuj minimalne, precyzyjne zmiany i wykonuj Deep Scan wpływu na modele, serwisy, routing i panele.

Wymagania UX:
- Priorytet: szybkość i czytelność.
- Animacje tylko gdy niosą informację.

Zadanie:
[TU WSTAW ZADANIE]

Kryteria akceptacji:
1) [kryterium 1]
2) [kryterium 2]
3) [kryterium 3]

Sposób odpowiedzi:
- Najpierw krótki plan.
- Potem konkretne zmiany w plikach.
- Na końcu: co zostało zrobione i co warto zrobić dalej.
```

### 10) Starter prompt ultra-krótki (quick fix)
Używaj tego wariantu, gdy zmiana jest mała i konkretna.

```text
Projekt: Docepo (Angular 21 + Capacitor, mobile-first, UI PL / kod EN).
Zasady: minimalna zmiana, nowoczesny Angular (signals/input), routing przez parametry URL, Deep Scan wpływu.
Zadanie: [TU WSTAW ZADANIE]. Kryteria: [1-2 krótkie punkty].
```

### 11) Stan implementacji (skrót)
Szczegóły bieżącego zachowania systemu znajdują się w sekcji 15.

- Dane: aktualnie mock w `moodle.service.ts`, docelowo Moodle API.
- Storage: używany `@capacitor/preferences` (klucz `moodleUrl`).
- Architektura UI: standalone components + częściowe użycie sygnałów Angular.

### 12) Kontrakt modeli (aktualny kod)
Ta sekcja jest źródłem prawdy dla AI przy modyfikacji modeli i serwisów.

#### Task (aktualnie)
- `id: string`
- `courseId: string`
- `name: string`
- `description: string`
- `maxPoints: number`
- `dueDate: Date`

#### Solution (aktualnie)
- `id: string`
- `studentId: string`
- `taskId: string`
- `completedAt: Date`
- `points: number`
- `comment: string`
- `status: '' | 'C' | 'G' | 'W' | 'U' | 'P' | 'N'`

Uwaga: status „nieocenione” jest obecnie pustym stringiem `''` (w UI może być pokazywany jako `-`).

### 13) Kontrakt routingu i nawigacji
Kanoniczny przepływ ekranów (obecnie używany):
- `/moodle-selection` → `/course` → `/groups/:courseId` → `/attendance/:classDateId` → `/student/:studentId/:groupId` → `/solution/:studentId/:taskId`

Zasady:
- Przekazuj dane kontekstowe przez parametry ścieżki i parametry query.
- Przyciski „wstecz” obsługuj przez `BackNavigationService` i `backTo` w `route.data`.
- Nie opieraj logiki na stosie historii przeglądarki.

Uwaga techniczna:
- W projekcie istnieją również trasy `/panel/...` (legacy/przejściowe). AI ma traktować je jako obszar do uporządkowania, a nie domyślny punkt rozbudowy.

### 14) Kontrakt storage
Klucze i ich znaczenie:
- `moodleUrl: string` – adres instancji Moodle, ustawiany na panelu wyboru Moodle.

Zasady:
- Guard wejścia do głównych paneli sprawdza obecność `moodleUrl`.
- Brak `moodleUrl` => przekierowanie na `/moodle-selection`.
- Dane trwałe zapisuj przez `StorageService` (opakowanie na `@capacitor/preferences`).

### 15) Stan ustaleń (zgodny z aktualnym kodem)
- Bieżące zajęcia: obowiązuje okno `start zajęć - 5 minut <= teraz <= end zajęć + 15 minut`.
- Status nieocenione w `Solution.status`: obecnie pusty string `''` (w UI może być pokazywany jako `-`).
- Routing: obowiązuje URL-first (parametry ścieżki + parametry query), bez logiki opartej o historię.
- Trasy legacy `/panel/...`: działają jako przekierowania kompatybilności do gałęzi kanonicznej.
- Aktualizacja obecności: wymaga `classDateId` i zapis jest dozwolony tylko dla bieżących zajęć (okno -5/+15 minut).

### 16) Ostatnie zmiany (log sesji AI)
- Refaktoryzacja logiki statusów do `setting/`:
	- `src/app/setting/solution.settings.ts` (statusy, etykiety, kolory, opisy, dostępne statusy).
	- `src/app/setting/attendance.settings.ts` (etykiety i predykaty statusów obecności).
- Ujednolicenie routingu i kontekstu:
	- usunięte duplikaty tras panelowych,
	- przepływ `classDateId` przez URL/query w ścieżce attendance → student → solution → back.
- Poprawki logiki obecności:
	- zapis/odczyt obecności przypięty do właściwego `classDateId`,
	- blokada modyfikacji dla terminów niebieżących,
	- sortowanie historii obecności studenta po `startTime` terminu.
- Logika bieżących zajęć:
	- `MoodleService` używa bufora `-5 min` przed startem i `+15 min` po końcu.
- Moodle selection / storage:
	- preload ostatniego `moodleUrl`,
	- lista endpointów nazwa+URL z domyślnym wpisem `ePortal - PWr`.
- Modern Angular:
	- migracje do `input()/output()` i sygnałów w komponentach common,
	- usunięcie legacy template patterns (`*ngIf/*ngFor/*ngSwitch`, `[ngClass]`, `[ngStyle]`) w aktualnym `src/`.

### 17) Integracja z Moodle – uprawnienia i zakres dla admina
Ta sekcja to gotowa lista do przekazania administratorowi Moodle przy uruchamianiu integracji produkcyjnej.

#### 17.1 Konfiguracja platformy
- Włączyć Web Services (`Enable web services`) i REST.
- Utworzyć dedykowane konto techniczne (service account) lub przypisać odpowiednią rolę nauczyciela.
- Wygenerować token Web Service dla aplikacji Docepo.
- Ograniczyć uprawnienia zgodnie z zasadą least privilege (tylko potrzebne kursy i operacje).

#### 17.2 Funkcje Web Service (minimum)
- `core_webservice_get_site_info` (weryfikacja tokena i kontekstu użytkownika).
- `core_enrol_get_users_courses` (kursy użytkownika; alternatywnie `core_course_get_courses`).
- `core_group_get_course_groups` (grupy kursowe).
- `core_enrol_get_enrolled_users` (uczestnicy kursu, w tym studenci).
- `mod_assign_get_assignments` (lista zadań).
- `mod_assign_get_submissions` (rozwiązania/oddania studentów).
- `mod_assign_save_grade` (zapis oceny/feedbacku – jeśli oceny mają być ustawiane z Docepo).

#### 17.3 Obecności (plugin Attendance)
Jeśli uczelnia używa modułu Attendance, dodać również funkcje pluginu (nazwy mogą się różnić zależnie od wersji):
- `mod_attendance_get_attendances`.
- `mod_attendance_get_sessions`.
- `mod_attendance_get_session`.
- `mod_attendance_update_user_status` (lub odpowiednik bulk update).

#### 17.4 Capabilities (rola)
Potwierdzić/ustawić uprawnienia roli dla konta integracyjnego:
- `moodle/course:view`.
- `moodle/user:viewdetails`.
- `moodle/site:viewparticipants`.
- `mod/assign:view`.
- `mod/assign:grade` (jeśli zapis ocen z aplikacji).
- Dostęp do grup w kursie (w razie potrzeby także `moodle/site:accessallgroups`, zależnie od polityki grup).
- Dla Attendance: `mod/attendance:view`, `mod/attendance:takeattendances` (opcjonalnie także `mod/attendance:changeattendances`, zależnie od konfiguracji).

#### 17.5 Zakres danych dla Docepo
- Odczyt: kursy, grupy, terminy zajęć, studenci, zadania, oddania.
- Zapis: status obecności (dla bieżących zajęć) oraz opcjonalnie oceny/feedback do zadań.

#### 17.6 Checklista wdrożeniowa
1) Potwierdzić wersję Moodle i wersję pluginu Attendance.
2) Utworzyć custom service dla Docepo i przypisać funkcje z pkt 17.2/17.3.
3) Przypisać konto integracyjne do właściwych kursów/roli.
4) Wygenerować token i przekazać bezpiecznym kanałem.
5) Wykonać testy end-to-end: kursy → grupy → obecności (odczyt/zapis) → zadania/rozwiązania.

