import {gradeAnswer} from './engine.mjs';

// Only tokens that occur in the paragraph are blanks. The legacy excerpt's
// token dictionary contains all five words in every paragraph.
export function exerciseItems(book){
 return book.paragraphs.flatMap((paragraph,index)=>[...paragraph.text.matchAll(/\[\[([\w-]+)\]\]/g)].flatMap(([,key])=>{
  const word=paragraph.tokens[key];
  return word?[{...word,key,paragraph:index}]:[];
 }));
}
export function exerciseAnswerKeys(books){
 return Object.fromEntries(books.map(book=>[book.id,[...new Set(exerciseItems(book).map(item=>item.key))]]));
}
export function gradeExerciseAnswer(answer,word){return gradeAnswer(answer,{en:word.en});}
export function summarizeExercise(book,answers={}){
 const items=exerciseItems(book),grades=items.map(item=>gradeExerciseAnswer(answers[item.key],item));
 return {total:items.length,filled:grades.filter(grade=>grade!=='empty').length,correct:grades.filter(grade=>grade==='correct').length};
}
