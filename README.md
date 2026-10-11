# film — Compileit filmsida (public hosting copy)

> **Provenance (MC 10444).** This repo is the **public hosting copy** served at
> **https://sibbamala.com/film/** by the vm106 reconciler. **Source of truth** =
> `compileit-ab/code-test`, branch `feature/compileit-filmsida`
> (`/srv/workspace/compileit-filmsida`, `8d4ea91` at port time). Fixes originate
> in the source line, not in this mirror (owner doctrine). How this repo's
> committed `deploy/` artifact is built: [DEPLOY-BUILD.md](DEPLOY-BUILD.md);
> runtime shape: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Ursprunglig projektbeskrivning (compileit-ab/code-test)

# Projektbeskrivning - skapa en filmsida

Din uppgift är att med NextJS skapa en webbsida där man kan filtrera och söka bland populära filmer. 

Börja med att klona ner detta repot som innehåller en template uppsättning av NextJS och skapa sedan en egen branch lokalt som du jobbar i.

Det finns ett färdigt API som du ska använda och det hittar du här:  
https://www.themoviedb.org/signup 

Det finns en färdig design gjord i Figma. Uppgiften är att göra det så likt designen som möjligt.  
https://www.figma.com/file/UXNYBBjexIGJu93hqh8gwj/Compileit-Case

Webbplatsen ska bestå av två sidor, en startsida och en discover-sida (se menyn i designskiss). 

På startsidan vill vi att du visar upp “trending”, “now playing” och “top rated” hämtat från API:et.

I alla vyer ska det finnas ett sökfält där man med fritextsök, via api:et, ska kunna söka efter en film.

På sidan “Discover” vill vi att du listar olika kategorier som en filtrering där resultatet av filmer är baserat på det aktiva filtret. Det ska bara gå att ha ett aktivt filter åt gången.

Rekommenderad tidsåtgång: Ca 4-8 timmar

## Leverans ?
Skapa en Pull Request på github för att mergea in din branch till main.


## Vad händer sen ?
När du lämnat in ditt projekt kommer vi att gå igenom koden 
som du har skrivit. Vid granskning av projekt kollar vi 
exempelvis på:

 - Kodstruktur  
 - Val av HTML-element
 - Hur väl designen implementerats

När vi kollat igenom koduppgiften kommer vi att återkomma 
med feedback till dig samt vad nästa steg blir.
