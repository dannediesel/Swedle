export type Player  = {
    id: number;
    fullName: string;
    club: string;
    birthYear: number;
    dominantFoot: string;
    shirtNumber: number;
    position: string;
    caps: number;
}

export const players: Player[] = [
    {
        id: 1,
        fullName: "Zlatan Ibrahimović",
        club: "AC Milan", "Ajax", "FC Barcelona", "Paris Saint-Germain", "Manchester United", "LA Galaxy", "Juventus", "Inter Milan", "Malmö FF",
        birthYear: 1981,
        dominantFoot: "Höger",
        shirtNumber: 10,
        position: "Anfallare"
        caps: 116
    },
    {
        id: 2,
        fullName: "Henrik Larsson",
        club: "Celtic", "Helsingborg IF", "FC Barcelona", "Feyenoord", "Manchester United",
        birthYear: 1971,
        dominatFoot: "Höger",
        shirtNumber: 7, 11, 17,
        positon: "Anfallare",
        caps: 106
    },
    {
        id: 3,
        fullName: "Alexander Isak",
        club: "Real Sociedad", "Borussia Dortmund", "AIK", "Liverpool" "Newcastle United",
        birthYear: 1999,
        dominantFoot: "Höger",
        shirtNumber: 9,
        position: "Anfallare",
        caps: 56
    },