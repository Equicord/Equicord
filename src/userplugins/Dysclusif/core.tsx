let pt = '(•|\\.|·|⋅|⸱|\\-)';
let optPt = `${pt}?`;
let notWord = `(?![a-zA-Z])`; // Not a word after

/* Regex, replacement, additional regex flags (i : case insensitive)*/
const expressions = [
    // Complete words
    [`(?<![a-zA-Z])tous${optPt}te${optPt}s|tou${pt}te${optPt}s${notWord}`, "tous", "i"],
    [`(?<![a-zA-Z])(iels|ils?${pt}elles|il${optPt}les)${notWord}`, "ils", "i"],
    [`(?<![a-zA-Z])(iel|il${pt}elle|il${optPt}le)${notWord}`, "il", "i"],
    [`(?<![a-zA-Z])celleux${notWord}`, "ceux", "i"],
    [`(?<![a-zA-Z])(la${optPt}e|le${optPt}a)${notWord}`, "le", "i"],
    [`(?<![a-zA-Z])du.de (la${notWord}|l')`, "du", "i"],

    // End of words
    [`s?${pt}(trice|e|ne|ice)${optPt}s${notWord}`, "s", ""], // spectateurs.trice.s

    [`nt${pt}e${notWord}`, "nt", ""], // réprésentant.e
    [`eur${pt}r?(esse|ice|euse)${optPt}s${notWord}`, "eurs", ""], // travailleur.euse.s
    [`(eurs?${pt}(se${optPt}s)|eurs${pt}(se${optPt}s?))${notWord}`, "eurs", ""], // chercheur.ses
    [`eurs?${optPt}r?ice${optPt}s${notWord}`, "eurs", ""], // directeurices
    [`eur${optPt}r?ice${notWord}`, "eur", ""], // directeurice
    [`eur${pt}(esse|se)${notWord}`, "eur", ""], // serveur.se
    [`iers?${pt}i?ère${optPt}s${notWord}`, "iers", ""], // derniers.ières
    [`nts?${pt}e${optPt}s${notWord}`, "nts", ""], // représentant.e.s
    [`e${optPt}aux${pt}lles${notWord}`, "eaux", ""], // nouveaux·elles

    [`aux${pt}(le|elle)s?${notWord}`, "aux", ""], // internationaux.les
    [`e${optPt}au${pt}lle${notWord}`, "eau", ""], // nouveau.elle
    [`ier${pt}i?ère${notWord}`, "ier", ""], // dernier.ière
    [`au${pt}(le|elle)${notWord}`, "au", ""], // nouveau.elle
    [`x${optPt}(ses|se|s)${notWord}`, "x", ""], // nombreux.ses
    [`ls?${pt}les${notWord}`, "ls", ""], // personnel.les
    [`fs?${pt}fe${optPt}s${notWord}`, "fs", ""], // chef.fe.s (le 2e . n'a pas trop de sens...)
    [`l${pt}le${notWord}`, "l", ""], // personnel.le
    [`es?${pt}e?sse${optPt}s${notWord}`, "es", ""], // hôtes.esse.s
    [`e${pt}e?sse${notWord}`, "e", ""], // hôte.sse

    [`${pt}(trice|e|ne|ice)${notWord}`, "", ""], // ancien.ne
    [`(${pt}e|\\(e\\))${notWord}`, "", ""], // .e / (e)

    // With explicit parenthesis
    [`\\((trice|e|ne|ice)\\)s${notWord}`, "s", ""], // instituteur(trice)s
    [`\\((trice|e|ne|ice)\\)${notWord}`, "", ""], // instituteur(trice)
    [`(?<![hlp])eureuse${notWord}`, "eur", ""], // Joueureuse, dangerexu car il y a les mots comme "heureuse"
    [`(?<![hlp])eurs?euse${optPt}s${notWord}`, "eurs", ""] // Joueureuses
];

let regexps: RegExp[] = [];
for (let i = 0; i < expressions.length; i++) {
    let regex = new RegExp(expressions[i][0], "g" + expressions[i][2]);
    regexps.push(regex);
}


export const cleanMessage = (text) => {
    let textReplacementsCount = 0;

    for (let i = 0; i < expressions.length; i++) {
        const regex = regexps[i];

        // Do the replacements with a loop and check if first elem is capitalized
        const matches = text.match(regex) || [];
        textReplacementsCount += matches.length;

        for (let j = 0; j < matches.length; j++) {
            let match = matches[j];

            let replacement = expressions[i][1];
            if (matches[j][0] !== match[0].toLowerCase())
                replacement = replacement[0].toUpperCase() + replacement.slice(1);

            text = text.replace(match, replacement);
        }
    }
    return [text, textReplacementsCount];
};
