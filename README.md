# University of Colorado Cancer Center PubMed Grader

This repository contains code for a web application that accepts a csv file with one column of pubmed ids and any number of additional columns.
The default name is pmid (case insensitive) with an optional user-specified column name for the pubmed column. 
The application will then query the iCite API to retrieve all iCite columns and append those columns to the original file rows.
The application will then return the file with the new columns added. 

The application is built using a fastapi backend and a react frontend. 
The number of items could be large, so the application is designed to run asynchronously and return a link that the user can check for status and download when ready. 


