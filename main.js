const GMAIL_FILTERS = "in:inbox";
const DRIVE_FOLDER = "GMAIL_SCRIPT";
const CONFIG_FOLDER = "CONFIG";
const FILES_FOLDER = "FILES";
const CONFIG_FILE_NAME = "config.json"

// Mapped variables for replies
function getReplyVars({ missingDocuments = [] } = {}) {
  let missingDocsMessage = "";
  for (const [docNames, docTypes] of missingDocuments) {
    const nameMessage = docNames.length <= 1 ? docNames.join('') : `${docNames.slice(0, -1).join(', ')} o ${docNames.slice(-1)}`;
    const typeMessage = docTypes.length <= 1 ? docTypes.join('') : `${docTypes.slice(0, -1).join(', ')} o ${docTypes.slice(-1)}`;
    missingDocsMessage += (`${nameMessage} (en formato ${typeMessage}).<br>`)
  }
  return {
    MISSING_DOCS: missingDocsMessage
  }
}

// Default configuration settings
const DEFAULT_CONFIG = {
  query: {
    fromDate: "29/07/2025",
    toDate: "",
  },
  types: {
    pasantia: {
      searchKeywords: ["pasantía", "pasante"],
      documents: [
        [["CURRICULUM_VITAE", "CV"], ["pdf", "doc", "docx"]],
        [["FACTURA_1"], ["jpg", "jpeg", "png"]],
        [["FACTURA_2"], ["jpg", "jpeg", "png"]]
      ]
    },
    exoneracion: {
      searchKeywords: ["exoneración", "exonerar"],
      documents: [
        [["REPORTE", "INFORME"], ["pdf", "xls", "xlsx"]],
        [["NOTAS"], ["pdf", "doc", "docx"]]
      ]
    },
    incripcion: {
      searchKeywords: ["inscripción", "inscribir"],
      documents: [
        [["OPSU"], ["pdf", "doc", "docx"]],
        [["NOTAS"], ["pdf", "doc", "docx"]]
      ]
    }
  },
  replyMessages: {
    error: `<p>No ha sido posible procesar su correo electrónico. Los siguientes documentos requeridos no fueron adjuntados:</p>
<p><strong>$MISSING_DOCS</strong></p>
<p>Este es un mensaje generado automáticamente. Por favor, no responder a este correo.</p>`,
    success: `<p>Hemos recibido y procesado su mensaje con éxito.</p>
<p>En breve, un coordinador se pondrá en contacto con usted.</p>
<p>Este es un mensaje generado automáticamente. Por favor, no responder a este correo.</p>`
  }
};

function main() {
  // Get configuration from Drive folder
  const { query, types, replyMessages } = findOrCreateConfigFile();
  const { error: errorMessage, success: successMessage } = replyMessages;
  const { fromDate, toDate } = query;

  if (!types) {
    Logger.log(`Error: 'types' property is not set or is empty. Please set it in ${DRIVE_FOLDER}/${CONFIG_FOLDER}/${CONFIG_FILE_NAME}`);
    return;
  }

  // Add API filters for the search query
  const fromDateFilter = fromDate ? `after:${fromDate}` : "";
  const toDateFilter = toDate ? `after:${toDate}` : "";

  for (const [type, { searchKeywords, documents: expectedDocuments }] of Object.entries(types)) {
    // Expand the keywords to include accents and plural forms
    const expandedKeywords = expandQueryKeywords(searchKeywords);

    const query = `${expandedKeywords.join(" OR ")} ${GMAIL_FILTERS} ${fromDateFilter} ${toDateFilter}`

    Logger.log(`Searching Gmail with query: '${query}'`);
    try {
      // GmailApp.search returns GmailThread objects.
      const threads = GmailApp.search(query);

      if (!threads.length) {
        Logger.log("No threads found for given query");
        return;
      }

      Logger.log(`Found ${threads.length} threads matching the query`);

      // Iterate through each thread and then each message within the thread
      for (const thread of threads) {
        const messages = thread.getMessages();

        // If is  more than one message in the thread, skip it
        // We assume it's a conversation or an already handled thread
        if (messages.length > 1) continue;

        // Handle the first and only message in the thread
        const message = messages[0];

        // Get attachments for that message
        const attachments = message.getAttachments();
        const attachmentNames = attachments.map(attachment => attachment.getName());

        // Search for the current expected documents
        const missingDocuments = [];
        for (const [docNames, docTypes] of expectedDocuments) {
          // Check if any of the possible document names with any of the possible extensions exist
          const found = docNames.some(docName => {
            const regex = new RegExp(`^${docName}\\.(${docTypes.join('|')})$`, 'i');
            return attachmentNames.some(attachmentName => regex.test(attachmentName));
          });

          if (!found) {
            missingDocuments.push([docNames, docTypes]);
          }
        }

        // If there are missing documents, reply to the sender with the error
        if (missingDocuments.length > 0) {
          replyToThread(thread, errorMessage, { missingDocuments });
          continue;
        }

        // If all documents are present, reply to the sender with success confirmation
        replyToThread(thread, successMessage, {});

        // Save documents to Google Drive
        const { senderName, senderEmail } = getSenderDetails(message);
        const subject = message.getSubject();
        const { timestamp, month, year } = getTimeDetails(message);

        const driveFolderPath = `${DRIVE_FOLDER}/${FILES_FOLDER}/${year}/${month.toUpperCase()}/${type.toUpperCase()}`

        let parentFolderId = null
        for (const folderName of driveFolderPath.split("/")) {
          parentFolderId = findOrCreateFolder(folderName, parentFolderId);
        }

        for (const attachment of attachments) {
          const attachmentName = `(${senderName}) (${timestamp}) (${attachment.getName()})`
          const attachmentDescription = `Email from ${senderName}_${senderEmail} with subject '${subject}' for type of email '${type}'`

          const attachmentDetails = {
            name: attachmentName,
            description: attachmentDescription,
            data: attachment.getBytes(),
            mimeType: attachment.getContentType()
          }

          saveToDrive(attachmentDetails, parentFolderId);
        }

      }
    } catch (err) {
      Logger.log(`Error occurred during Gmail search: ${err.message}`);
    }
  }
}

// Helper function to form a message with the given variables and reply to a thread
function replyToThread(thread, message, inlineVars) {
  const replyVars = getReplyVars(inlineVars);
  const replyMessage = message.replace(/\$([A-Z_]+)/g, (match, p1) => {
    return replyVars[p1] || match;
  });
  thread.reply(replyMessage, { htmlBody: replyMessage });
}

// Retrieve configuration from Google Drive
function findOrCreateConfigFile() {
  Logger.log("Checking for Drive configuration file...");
  // Initialize with default config
  let config = DEFAULT_CONFIG;

  // Get or create the root Drive folder
  const rootFolderId = findOrCreateFolder(DRIVE_FOLDER);

  // Get or create the configuration folder inside the root folder
  const configFolderId = findOrCreateFolder(CONFIG_FOLDER, rootFolderId);

  // Search for the configuration file within the config folder
  const configFolder = DriveApp.getFolderById(configFolderId);
  const files = configFolder.getFilesByName(CONFIG_FILE_NAME);

  // If the file exists, retrieve its content. If not, create it with default settings
  if (files.hasNext()) {
    const configFile = files.next();
    const fileContent = configFile.getBlob().getDataAsString();
    config = JSON.parse(fileContent);
    Logger.log(`Configuration file '${CONFIG_FILE_NAME}' found and loaded.`);
  } else {
    // configFolder.createFile(CONFIG_FILE_NAME, JSON.stringify(DEFAULT_CONFIG, null, 2), MimeType.JSON);
    const configBlob = Utilities.newBlob(JSON.stringify(DEFAULT_CONFIG, null, 2), MimeType.JSON, CONFIG_FILE_NAME);
    configFolder.createFile(configBlob);
    Logger.log(`Configuration file '${CONFIG_FILE_NAME}' not found. Created with default settings.`);
  }

  return config;
}

// Helper function to get time details from date field in a Gmail's message
function getTimeDetails(message) {
  const dateObject = message.getDate();

  if (!dateObject || !(dateObject instanceof Date)) {
    return { month: null, year: null, timestamp: null };
  }

  const year = dateObject.getFullYear().toString();
  const month = dateObject.toLocaleDateString('en-US', { month: 'long' });
  const timestamp = dateObject.toLocaleTimeString('es-VE', { hour12: false });

  return { month, year, timestamp };
}

// Helper function to get name and email from the sender field in a Gmail's message
function getSenderDetails(message) {
  const sender = message.getFrom();
  let senderName = '';
  let senderEmail = '';

  const match = sender.match(/^"?(.*?)"?\s*<(.*)>$/);

  if (match) {
    // Handles "Name <email@example.com>" or "<email@example.com>"
    senderName = match[1].trim();
    senderEmail = match[2].trim();
  } else {
    // Handles "email@example.com" (no angle brackets to separate the name part)
    senderEmail = sender.trim();
  }

  // Derive name from email if no found name
  if (senderName === '' || senderName === senderEmail) {
    senderName = senderEmail.split('@')[0];
  }

  return { senderName, senderEmail };
}

// Find a folder by name in a specific parent folder. If it doesn't exist, create it
function findOrCreateFolder(folderName, parentFolderId = null) {
  try {
    const parentFolder = parentFolderId
      ? DriveApp.getFolderById(parentFolderId)
      : DriveApp.getRootFolder();

    const folders = parentFolder.getFoldersByName(folderName);

    if (folders.hasNext()) {
      return folders.next().getId()
    } else {
      Logger.log(`Folder '${folderName}' not found in '${parentFolder.getName()}', creating...`);

      const folder = parentFolder.createFolder(folderName);

      Logger.log(`Folder '${folderName}' created with ID: ${folder.getId()}`);

      return folder.getId();
    }
  } catch (err) {
    Logger.log(`Error occurred: ${e.message}`);
    return null;
  }
}

// Save the file to Google Drive
function saveToDrive(attachmentDetails, parentFolderId) {
  try {
    // Check if attachment already exists in Drive folder
    const fileId = checkFileExistenceInFolder(attachmentDetails.name, parentFolderId);
    if (fileId) {
      Logger.log(`Skipping upload for '${attachmentDetails.name}' as it already exists`);
      return;
    }

    // Get Drive folder
    const driveFolder = DriveApp.getFolderById(parentFolderId);

    // Save file to Drive folder
    const driveFile = driveFolder.createFile(attachmentDetails.name, attachmentDetails.data, attachmentDetails.mimeType);

    // Add description to created file
    driveFile.setDescription(attachmentDetails.description)

    Logger.log(`File '${attachmentDetails.name}' saved to Drive with ID: ${driveFile.getId()}`);
  } catch (err) {
    Logger.log(`Error saving file '${attachmentDetails.name}' to Drive: ${err.message}`);
  }
}

// Checks if a file with the given name exists in the specified folder. Returns the file ID if it exists
function checkFileExistenceInFolder(filename, folderId) {
  try {
    const folder = DriveApp.getFolderById(folderId);

    const files = folder.getFilesByName(filename);

    const fileId = files.hasNext() ? files.next().getId() : null;

    return fileId;
  } catch (err) {
    Logger.log(`Error checking file existence in folder '${folderId}': ${err.message}`);
    return null;
  }
}

// Function to expand query keywords by adding plural forms and spell-checked candidates (TODO)
function expandQueryKeywords(keywords) {
  const expandedKeywords = new Set();

  if (!keywords) {
    return [];
  }

  for (const keyword of keywords) {
    // Skip empty strings from multiple spaces
    if (!keyword.trim()) continue;

    // Transform to lower case
    lowerCaseKeyword = keyword.toLowerCase()

    // Add the original keyword and normalized version (without accents)
    expandedKeywords
      .add(lowerCaseKeyword)
      .add(lowerCaseKeyword.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

    // Add plural form if it exists and is different from the original
    const pluralFormOriginal = pluralize(lowerCaseKeyword);
    if (pluralFormOriginal && pluralFormOriginal !== lowerCaseKeyword) {
      expandedKeywords.add(pluralFormOriginal);
    }

    // Add naive accented versions of the keyword
    const correctedCandidates = getAccentCandidates(lowerCaseKeyword);

    if (correctedCandidates.length) {
      for (const correctedWord of correctedCandidates) {
        // Add spell-checked candidate
        expandedKeywords.add(correctedWord);

        // Add plural form
        const plural_form_corrected = pluralize(correctedWord);
        if (plural_form_corrected && plural_form_corrected != correctedWord) {
          expandedKeywords.add(plural_form_corrected);
        }
      }
    }
  }

  // Convert Set back to an array
  return Array.from(expandedKeywords);
}