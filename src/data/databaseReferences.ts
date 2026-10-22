import {CATEGORIES,getManagedCategories} from './categories';
import {BRANDS,getManagedBrands} from './brands';
/** Keep legacy component imports on the hydrated database arrays, including after admin edits. */
export function installDatabaseReferences(){
 const categories=getManagedCategories(),brands=getManagedBrands();
 CATEGORIES.splice(0,CATEGORIES.length,...categories);
 BRANDS.splice(0,BRANDS.length,...brands);
}
