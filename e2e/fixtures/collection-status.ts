import {referenceHomeGame,REFERENCE_DATE} from './reference-home';
import {act} from '../../src/game/hardcore/play';
import {actWithTime} from '../../src/game/hardcore/time-source';
import {breedingRisk} from '../../src/game/hardcore/breeding-risk';
import {addDays} from '../../src/game/hardcore/time';
import {validateGame} from '../../src/game/hardcore/validation';

/** Real mating/laying creates the resting mother; only the growth review age is set. */
export function collectionStatusGame(){
  let game=referenceHomeGame();game.money=2_000_000;game.food=200;
  const [mother,father,growing,female,otherMale]=Object.values(game.individuals).map(g=>g.id);
  const risk=breedingRisk(game,game.individuals[father],game.individuals[mother]);
  game=act(game,{type:'breed',fatherId:father,motherId:mother,riskAcknowledgement:risk.acknowledgement},REFERENCE_DATE);
  for(let n=0;n<4;n++)game=actWithTime(game,{type:'endTurn'},REFERENCE_DATE);
  const child=game.individuals[growing];child.stage='juvenile';child.birthTurn=game.turn-10;child.birthDate=addDays(game.lastDate,-70);
  child.nextBreedTurn=game.turn+2;child.cycleAnchor=child.recoverUntil=addDays(game.lastDate,14);
  // Duplicate names make ID-based shortcuts observable, independently of card position.
  game.individuals[father].name=game.individuals[otherMale].name='같은 이름';
  validateGame(game);return {game,mother,father,growing,female,otherMale};
}
