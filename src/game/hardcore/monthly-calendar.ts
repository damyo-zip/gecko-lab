import type {HardcoreGame} from './model';
import {addDays,daysBetween} from './time';
/** One age tick is exactly one month. Dates use fixed 30-day logical months;
 * the migration anchor keeps all earlier dated history intact. */
export function turnDate(game:HardcoreGame,turn:number):string {
 const c=game.monthlyCalendar;
 if(!c)return addDays(game.lastDate,(turn-game.turn)*7);
 return addDays(c.date,(turn-c.turn)*(c.legacy&&turn<c.turn?7:30));
}
export function dateTurn(game:HardcoreGame,date:string):number {
 const c=game.monthlyCalendar;
 if(!c)return game.turn+Math.floor(daysBetween(game.lastDate,date)/7);
 return c.turn+Math.floor(daysBetween(c.date,date)/(c.legacy&&date<c.date?7:30));
}
