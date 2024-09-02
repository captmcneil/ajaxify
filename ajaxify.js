/**
 * Setting the class 'open-modal' on a hyperlink will open the target URL inline in the current document,
 * without an IFrame, either as a bootstrap modal or in a specified container element (the 'target').
 * The hyperlinks' click will be converted into an ajax request, and the contents of the response patched into the target element.
 * 
 * By default, the <main> element of the requested page will be cut out. You can override this by specifying 'data-content-selector'.
 * 
 * This library attempts to provide a bridge between opening responses in IFrames and going full SPA (single-page-application).
 *
 * Note that this approach has certain limitations:
 * - the document.ready event will not be fired again for the requested page
 * - none of the requested page's link, script or style tags will be loaded
 */
$(function () {
	let modalTarget;
	let panelTarget;

	/**
	 * Gets the target element, to which we add the contents of the response.
	 * This is either a bootstrap modal, or a simple div.
	 * The target object provides an abstraction of those 2 cases with an element property and a fill, show and clear function.
	 */
	function getTarget(useModal) {
		if (useModal) {
			return modalTarget || (modalTarget = createModalTarget());
		} else {
			return panelTarget || (panelTarget = createPanelTarget());
		}
	}

	/**
	 * Creates an interface target object for loading the response in a bootstrap modal.
	 * 
	 * @returns {object} The interface object.
	 */
	function createModalTarget() {
		const boostrapVersion = typeof window.bootstrap === 'undefined'
			? typeof $.fn === 'undefined' || typeof $.fn.tooltip === 'undefined'
				? undefined
				: $.fn.tooltip.Constructor.VERSION
			: window.bootstrap.Tooltip.VERSION;

		if (!boostrapVersion || typeof boostrapVersion !== 'string') {
			throw new Error('Bootstrap version could not be identified.');
		}

		const isBootstrap3 = boostrapVersion.substring(0, 1) === '3';
		const isBootstrap4 = boostrapVersion.substring(0, 1) === '4';

		// we only have one modal and reuse it
		// this keeps the page clean of duplicate IDs and events on nodes that will never again been shown
		// the contents of the modal will be removed, when the modal is closed
		const modal = createModal();

		// lazily add the modal to the document
		let isAddedToBody = false;

		function createModalCloseButton() {
			if (isBootstrap3 || isBootstrap4) {
				return $('<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>')
			} else {
				return $('<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>')
			}
		}

		/**
		 * Creates a bootstrap modal.
		 * 
		 * @returns The modal.
		 */
		function createModal() {
			const modal = $('<div class="modal fade ajax-response-target" role="dialog">'),
				modalDialog = $('<div class="modal-dialog">'),
				modalContent = $('<div class="modal-content">'),
				modalBody = $('<div class="modal-body">'),
				modalHeader = $('<div class="modal-header">'),
				modalCloseButton = createModalCloseButton();

			// bootstrap 3 uses float layout, so it makes sense to add the close button first
			if (isBootstrap3) {
				modalHeader.append(modalCloseButton);
				modalContent.append(modalHeader);
			} else {
				modalContent.append(modalHeader);
				modalHeader.append(modalCloseButton);
			}
			modalContent.append(modalBody);
			modalDialog.append(modalContent);
			modal.append(modalDialog);
			return modal;
		}

		/**
		 * Clear the bootstrap modal content after the hide event was issued, in order to avoid unnecessary event registrations, duplicate IDs and such.
		 */
		modal.on('hidden.bs.modal', function () {
			const args = {
				currentTarget: modal
			};

			$('body').trigger('modal:modal-closing', args);
			that.clear(args);
			$('body').trigger('modal:modal-closed', args);
		});

		/**
		 * Handles a user request to close the panel.
		 */
		modal.on(
			'modal:modal-close',
			() => that.hide({
				currentTarget: modal
			}));

		const that = {
			element: modal,

			/**
			 * Puts HTML content into the modal.
			 *
			 * @param {string} bodyContent The content of the modal body as HTML.
			 * @param {string} title The modal's title text.
			 * @param {string} size The size (either nothing for default size, large or small).
			 */
			fill: function (bodyContent, title, size, args) {
				that.clear(args);

				const modalHeader = modal.find('.modal-header');
				const modalBody = modal.find('.modal-body');
				const modalDialog = modal.find('.modal-dialog');

				if (isBootstrap3) {
					// restore the close button
					modalHeader.append(createModalCloseButton());
				}

				if (title) {
					const titleHeader = $('<h5>');
					titleHeader.text(title);
					modalHeader.append(titleHeader);
				}

				if (!isBootstrap3) {
					// restore the close button
					modalHeader.append(createModalCloseButton());
				}

				if (size === 'large') {
					modalDialog.addClass('modal-lg');
				} else if (size === 'small') {
					modalDialog.addClass('modal-sm');
				}

				modalBody.append(bodyContent);
			},

			/**
			 * Lazily adds the modal to the page and displays it.
			 */
			show: function (_, args) {
				// lazily add the modal to the document - note that we only have one modal which we reuse
				if (!isAddedToBody) {
					$('body').append(modal);
					isAddedToBody = true;
				}

				// show the modal, if it is not already visible
				modal.modal('show');

				$('body').trigger('modal:modal-opened', args);
			},
			
			/**
			 * Hides the modal and clears it.
			 */
			hide: function (args) {
				$('body').trigger('modal:modal-closing', args);

				// lazily add the modal to the document - note that we only have one modal which we reuse
				if (!isAddedToBody) {
					return;
				}

				modal.modal('hide');
				that.clear(args);

				$('body').trigger('modal:modal-closed', args);
			},

			/**
			 * We call this when the current modal is being closed, or before its content is being replaced.
			 */
			clear: function (args) {
				const modalHeader = modal.find('.modal-header');
				const modalBody = modal.find('.modal-body');
				const modalDialog = modal.find('.modal-dialog');

				modalHeader.empty();
				modalBody.empty();
				modalDialog.removeClass('modal-sm');
				modalDialog.removeClass('modal-lg');

				$('body').trigger('modal:modal-cleared', args);
			}
		};

		return that;
	}

	/**
	 * Creates an interface target object for loading the response in a div.
	 * 
	 * @returns {object} The interface object.
	 */
	function createPanelTarget() {
		const panel = $('<div class="ajax-response-target">');

		/**
		 * Handles a user request to close the panel.
		 */
		panel.on(
			'modal:modal-close',
			() => that.hide({
				currentTarget: panel
			}));

		const that = {
			element: panel,

			/**
			 * Puts HTML content into the modal.
			 *
			 * @param {string} bodyContent The content of the modal body as HTML.
			 * @param {string} title The modal's title text.
			 * @param {string} size The size (either nothing for default size, large or small).
			 */
			fill: function (bodyContent, title, size, args) {
				that.clear(args);
				panel.append(bodyContent);
			},

			/**
			 * Lazily adds the modal to the page and displays it.
			 * 
			 * @param {string} targetContainerSelector A DOM selector that determines where the request content should be placed on the page.
			 */
			show: function (targetContainerSelector, args) {
				if (!targetContainerSelector) {
					console.error('OpenAsModal: Target element must be specified when modals are disabled.');
					return;
				}

				const targetContainer = $(targetContainerSelector);
				if (targetContainer.length !== 1) {
					console.error('OpenAsModal: Target element not found or ambiguous selector.');
					return;
				}

				panel.parent().removeClass('in');
				targetContainer.append(panel);
				targetContainer.addClass('in');

				$('body').trigger('modal:modal-opened', args);
			},
			
			/**
			 * Hides the panel and clears it.
			 */
			hide: function (args) {
				$('body').trigger('modal:modal-closing', args);

				panel.parent().removeClass('in');

				// let animaions run through
				setTimeout(function () {
					that.clear();
					$('body').trigger('modal:modal-closed', args);
				}, 300);
			},

			/**
			 * We call this when the current panel is being closed, or before its content is being replaced.
			 */
			clear: function (args) {
				panel.empty();

				$('body').trigger('modal:modal-cleared', args);
			}
		};

		return that;
	}

	/**
	 * Parses a response and gets the HTML contents of the body, if it exists.
	 * 
	 * @param {string} responseText The HTML code of the response we want to parse.
	 * @param {string} contentSelector The DOM selector that selects the part of the page that should be rendered inside the modal's body.
	 * @return The contents of the response document's body as a jQuery.
	 */
	function parseBody(responseText, contentSelector) {
		const bodyMatchArray = responseText.match(/<body[^>]*>[\s\S]*<\/body>/gi);
		if (bodyMatchArray.length === 0) {
			return undefined;
		}

		// search the body for a fitting content element - 
		// either the specified contentSelector, the < main > element or the whole body, if nothing was specified
		// important: add contents to an empty div, otherwise find won't find anything if the main is the direct child
		const body = $('<div>').append(bodyMatchArray[0]);
		if (contentSelector) {
			return body.find(contentSelector).children();
		} else {
			const main = body.find('main');
			if (main.length === 1) {
				return main.children();
			} else {
				return body.children();
			}
		}
	}

	/**
	 * Reads the HTML contents from a response, and puts it into the target element.
	 *
	 * @param {any} response The AJAX response, as in the ajax success callback.
	 * @param {any} settings Object containing:
	 * 'title': the modal's title text, the modal size (either nothing for default size, large or small),
	 * 'contentSelector': the DOM selector that selects the part of the page that should be rendered inside the modal's body and other values,
	 * 'handleFormSubmit': a flag determining whether the response of form submits of the content should be displayed in the modal,
	 * 'targetContainerSelector': an optional DOM selector that determines where the request content should be placed on the page.
	 * @return The contents of the response document as a jQuery, that were added to the modal body.
	 */
	function openResponse(response, target, settings, args) {
		const responseText = response.responseText;
		if (!responseText) {
			console.error('OpenAsModal: The page could not be displayed (responseText was empty).');
			const errorMessage = $('<p>');
			errorMessage.text('' + response.status + ': ' + response.statusText);

			target.fill(errorMessage, settings.title, settings.size, args);
			target.show(settings.targetContainerSelector, args);

			return;
		}

		const bodyContent = parseBody(responseText, settings.contentSelector);
		if (!bodyContent) {
			console.error('OpenAsModal: The page could not be displayed (no body content found).');

			target.fill($('<p>The page could not be displayed.</p>'), title, size, args);
			target.show(settings.targetContainerSelector, args);

			return;
		}

		target.fill(bodyContent, settings.title, settings.size, args);

		if (settings.handleFormSubmit) {
			// if the content contains a form, we put the response of the form submission into this modal as well
			// this allows for forms to be put in modals

			function ajaxSubmitHandler(event) {
				const form = $(event.currentTarget);

				// cancel the form submit and submit the form via ajax
				// idea being, that we wanna patch the response in the modal
				event.preventDefault();

				const url = form.attr('action') || '';
				const method = form.attr('method') || 'get';

				if (!url) {
					console.error('OpenAsModal: Form submit could not be ajax-ified, because the form action is empty.');
					return false;
				}

				const args = {
					url: url,
					target: target,
					settings: settings
				};

				$('body').trigger('modal:modal-opening', args);

				$.ajax({
					url: url,
					method: method,
					data: form.serialize(),
					dataType: 'text/html',
					complete: function (data) {
						openResponse(data, target, settings, args);
					}
				});
			}

			// if the body content is the form, register the event on it, otherwise search for the form
			const directFormChilds = bodyContent.toArray().filter(aContent => aContent.tagName.toLowerCase() === 'form');
			if (directFormChilds.length > 0) {
				$(directFormChilds).on('submit', ajaxSubmitHandler);
			} else {
				bodyContent.on('submit', 'form', ajaxSubmitHandler);
			}
		}

		// raise an event so scripts have a chance to initialize the modal page
		$('body').trigger('modal:ajax-content-loaded', args);

		target.show(settings.targetContainerSelector, args);
	}

	/**
	 * Registers an event handler on all links that should be opened as modals.
	 */
	$(document).on('click', '.open-modal', function (event) {
		const size = $(event.currentTarget).data('modal-size'),
			title = $(event.currentTarget).attr('title'),
			url = $(event.currentTarget).attr('href') || $(event.currentTarget).data('target'),
			contentSelector = $(event.currentTarget).data('content-selector'),
			handleFormSubmit = !!$(event.currentTarget).data('handle-form-submit'),
			targetContainerSelector = $(event.currentTarget).data('target-container-selector');

		if (!url) {
			console.error('OpenAsModal: Element cannot be ajax-ified, because neither a href nor a data-target are specified.');
			return false;
		}

		const settings = {
			title: title,
			size: size,
			contentSelector: contentSelector,
			handleFormSubmit: handleFormSubmit,
			targetContainerSelector: targetContainerSelector
		};

		// whether we use a modal or a panel
		const useModal = !targetContainerSelector;

		const target = getTarget(useModal);

		const args = {
			url: url,
			currentTarget: target.element,
			settings: settings
		};
		
		$('body').trigger('modal:modal-opening', args);

		// ruft die URL ab, liest den body > main ab und packt ihn in ein Bootstrap-Modal
		// Achtung: Skripte und CSS werden dabei nicht mitgeladen
		$.ajax({
			url: url,
			complete: function (data) {
				openResponse(data, target, settings, args);
			}
		});

		// disable href link behaviour
		return false;
	});
}());