# UX/UI Usability Feedback — Fokus-Timer App

Ich habe mir die gesamte App gründlich angeschaut: Timer-View, Dashboard (Tag, Projekte, Woche, Kalender), Settings (Projekte & Kategorien), und die verschiedenen UI-Elemente. Hier mein Feedback:

---

## 1. Informationsarchitektur & Layout

**Linke Spalte (Timer) vs. Rechte Spalte (Tageslog/Todos):** Das Zwei-Spalten-Layout auf der Timer-Seite funktioniert grundsätzlich, aber die rechte Spalte ist extrem vollgepackt — Tagesziel-Balken, Statistiken, Tageslog-Einträge *und* Todos sind übereinander gestapelt. Das macht die Seite visuell schwer zu scannen. Ich würde empfehlen, Tageslog und Todos visuell stärker voneinander zu trennen, z.B. durch klarere Section-Header mit mehr Abstand oder durch einklappbare Sektionen.

**Die "35 / 200 min" Tagesziel-Anzeige** mit den kleinen farbigen Segmenten ist auf den ersten Blick schwer zu lesen. Die Segmente (rot, grün, grau) haben keine Legende und sind zu klein, um intuitiv verstanden zu werden. Hier wäre ein Tooltip on hover oder eine kleine Legende hilfreich.

## 2. Visuelle Hierarchie & Typografie

**XP / MIN / STREAK Anzeige (oben rechts im Header):** Die Zahlen 37, 35, 0 stehen dort mit winzigen Labels darunter. Die Hierarchie ist unklar — man muss genau hinschauen, um zu verstehen, was diese Werte bedeuten. Die drei Metriken konkurrieren visuell mit dem Datum und dem Nutzernamen auf der linken Seite. Empfehlung: entweder gruppieren und visuell einrahmen oder in eine eigene Zeile/Sektion verschieben.

**"Néos Neuling" und "Level 1 — 7%":** Die Gamification-Elemente sind visuell sehr zurückhaltend. Das ist einerseits gut (nicht ablenkend), aber der Level-Fortschrittsbalken ist so dünn und subtil, dass man ihn fast übersieht. Wenn Gamification motivieren soll, darf sie ruhig etwas prominenter sein.

## 3. Farbige Punkte / Tags an den Log-Einträgen

Unter jedem Tageslog-Eintrag gibt es kleine farbige Punkte (rot, blau, grün). Diese sind **extrem klein** und völlig ohne Erklärung. Ich konnte beim besten Willen nicht herausfinden, was sie bedeuten — Kategorien? Werte? Energie-Level? Das ist ein klares Discoverability-Problem. Empfehlung: Punkte durch lesbare Mini-Tags/Chips ersetzen oder zumindest Tooltips anzeigen.

## 4. Todo-Bereich

**"1 offene Aufgaben von gestern"-Banner:** Gut, dass auf Altlasten hingewiesen wird. Aber das Wort "Aufgaben" sollte hier Singular sein ("1 offene Aufgabe"). Kleiner Grammatik-Bug.

**"Übernehmen"-Button:** Nicht sofort klar, was "Übernehmen" hier bedeutet. Wird die Aufgabe von gestern auf heute übernommen? Wird sie als aktuelle Fokus-Aufgabe übernommen? Ein klarerer Label wie "Auf heute übertragen" oder "Heute fortsetzen" wäre verständlicher.

**Todo-Checkboxen:** Die Checkboxen links neben den Todos sind kaum sichtbar — sie verschmelzen fast mit dem Hintergrund. Mehr Kontrast oder ein sichtbarer Border wäre hier wichtig (Accessibility!).

**"×" zum Löschen:** Der Lösch-Button ist ebenfalls sehr blass und nah an der Checkbox. Versehentliches Löschen statt Abhaken wäre möglich. Empfehlung: den Lösch-Button erst on hover zeigen oder räumlich weiter von der Checkbox entfernen.

## 5. Timer-Darstellung

Der Timer selbst ist gut — groß, klar, mit dem Kreis-Fortschritt drumherum. Zwei Dinge:

Die Beschriftung "FOKUS" unter dem Timer ist rein informativ, aber es fehlt eine Möglichkeit, den Modus direkt zu sehen oder zu wechseln (Fokus vs. Pause?). Wenn es verschiedene Timer-Modi gibt, wäre das hier nicht erkennbar.

Der **Pause-Button** ist der einzige Button — es gibt keinen "Stop" oder "Abbrechen"-Button. Das ist einerseits gut (verhindert versehentliches Beenden), aber für den Fall, dass man einen Timer falsch gestartet hat, fehlt eine Korrektur-Möglichkeit.

## 6. Navigation

**Timer / Dashboard / Settings** als Top-Nav funktioniert gut und ist klar. Allerdings: Im Dashboard-View wird der laufende Timer als roter Banner oben eingeblendet, was gut ist — man verliert den Timer nicht aus den Augen. Aber der Banner überdeckt teilweise die Settings-Navigation (ich konnte "Settings" im Banner-Bereich kaum noch lesen).

**Dashboard-Tabs (Tag / Projekte / Woche / Kalender):** Gute Struktur, aber die inaktiven Tabs haben zu wenig visuellen Kontrast zum aktiven Tab. Nur die Textfarbe ändert sich — ein dezenter Background-Shift oder eine Unterstreichung würde helfen.

## 7. Dashboard — Woche

Die Wochenübersicht ist informativ, aber der Chart (Pomodoros & XP pro Tag) ist visuell etwas verwirrend: Die XP-Linie (grün) springt enorm (1 → 6 → 18 → 0 → 2), während die Pomodoro-Balken nur am heutigen Tag angezeigt werden. Es ist unklar, ob fehlende Balken "0 Pomodoros" oder "keine Daten" bedeuten.

## 8. Settings

**Projekte-Liste:** Jedes Projekt hat "Bearbeiten" und "Deaktivieren" als Buttons. Gut. Aber die farbigen Linien links neben den Projektnamen haben keine Erklärung. Sind das frei wählbare Farben? Kategorien? Ebenfalls ein Discoverability-Problem.

**Kategorien-Liste:** Die Emoji-Icons neben den Kategorien sind nett, aber einige Kategorien (Business Partnerschaft, PeaceOfMind, Marketing, AppEntwicklung) haben graue Platzhalter-Icons statt echter Emojis. Das wirkt unfertig.

**"Aus"-Button bei Kategorien:** Was bedeutet "Aus"? Wird die Kategorie deaktiviert? Ausgeblendet? Gelöscht? Unklar. Besser wäre "Deaktivieren" (wie bei Projekten) oder ein Toggle-Switch.

## 9. Allgemeine Accessibility-Punkte

**Kontrast:** Viele sekundäre Elemente (Timestamps "12:05", "11:24", die Punkte, Checkboxen, Lösch-Buttons) sind sehr kontrastarm. Das dürfte bei WCAG-AA-Prüfung durchfallen.

**Touch-Targets:** Die farbigen Punkte, die "×"-Buttons und die "+"-Buttons zum Hinzufügen von Aufgaben sind visuell sehr klein. Auf Touch-Geräten wäre das problematisch.

**Keyboard-Navigation:** Nicht getestet, aber die Button-Struktur im DOM sieht okay aus. Allerdings sind viele Elemente als `generic` statt semantisch korrekt getaggt — das könnte Screenreader-Probleme verursachen.

## 10. Kleinigkeiten

Der **Link im Tageslog** (die volle LinkedIn-URL) bricht visuell aus und wird abgeschnitten. Besser wäre es, nur den Titel oder eine gekürzte Version anzuzeigen und den Link klickbar zu machen.

Die **Mondsichel (🌙)** und der **Lautsprecher (🔊)** oben rechts sind funktional unklar — Dark Mode und Sound-Toggle? Kein Tooltip, keine Erklärung.

---

**Zusammenfassung der Top-5 Quick Wins:**
1. Tooltips/Labels für die farbigen Punkte und Tagesziel-Segmente
2. Todo-Checkboxen und Lösch-Buttons kontrastreicher gestalten
3. "Übernehmen" → klarer labeln ("Auf heute übertragen")
4. Grammatik-Fix: "1 offene Aufgabe" (Singular)
5. Settings: "Aus" → "Deaktivieren" oder als Toggle gestalten
