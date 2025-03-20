/**
 * ajaxify.js v1.1.0
 *
 * Setting the class 'ajaxify' on a hyperlink will open the target URL inline in the current document,
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
(function () {
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
		const $modal = createModal();
		$('body').append($modal);

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
			const $modal = $('<div class="modal fade ajax-response-target" role="dialog">'),
				$modalDialog = $('<div class="modal-dialog">'),
				$modalContent = $('<div class="modal-content">'),
				$modalBody = $('<div class="modal-body">'),
				$modalHeader = $('<div class="modal-header">'),
				$modalCloseButton = createModalCloseButton();

			// bootstrap 3 uses float layout, so it makes sense to add the close button first
			if (isBootstrap3) {
				$modalHeader.append($modalCloseButton);
				$modalContent.append($modalHeader);
			} else {
				$modalContent.append($modalHeader);
				$modalHeader.append($modalCloseButton);
			}
			$modalContent.append($modalBody);
			$modalDialog.append($modalContent);
			$modal.append($modalDialog);
			return $modal;
		}

		/**
		 * Clear the bootstrap modal content after the hide event was issued, in order to avoid unnecessary event registrations, duplicate IDs and such.
		 */
		$modal.on('hidden.bs.modal', function () {
			const args = {
				target: that
			};

			$('body').trigger('ajaxify:closing', args);
			that.clear(args);
			$('body').trigger('ajaxify:closed', args);
		});

		/**
		 * Handles a user request to close the panel.
		 */
		$modal.on(
			'ajaxify:close',
			() => that.hide({
				target: that
			}));

		const that = {
			element: $modal.get(0),

			/**
			 * Puts HTML content into the modal.
			 *
			 * @param {string} bodyContent The HTML content to add.
			 * @param {string} title The title text (only applies to modals).
			 * @param {string} size The size (either nothing for default size, large or small, only applies to modals).
			 */
			fill: function (bodyContent, title, size, args) {
				that.clear(args);

				const modalHeader = $modal.find('.modal-header');
				const modalBody = $modal.find('.modal-body');
				const modalDialog = $modal.find('.modal-dialog');

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
			 * Lazily adds the modal to the page, if necessary.
			 */
			append: function (_, args) {
				// nothing to do, we have one modal and we reuse it
			},

			/**
			 * Displays the modal, if it is not already visible.
			 */
			show: function (_, args) {
				// show the modal, if it is not already visible
				$modal.modal('show');

				$('body').trigger('ajaxify:opened', args);
			},

			/**
			 * Hides the modal and clears it.
			 */
			hide: function (args) {
				$('body').trigger('ajaxify:closing', args);

				$modal.modal('hide');
				that.clear(args);

				$('body').trigger('ajaxify:closed', args);
			},

			/**
			 * We call this when the current modal is being closed, or before its content is being replaced.
			 */
			clear: function (args) {
				const $modalHeader = $modal.find('.modal-header');
				const $modalBody = $modal.find('.modal-body');
				const $modalDialog = $modal.find('.modal-dialog');

				$modalHeader.empty();
				$modalBody.empty();
				$modalDialog.removeClass('modal-sm');
				$modalDialog.removeClass('modal-lg');

				$('body').trigger('ajaxify:cleared', args);
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
		const $panel = $('<div class="ajax-response-target">');

		/**
		 * Handles a user request to close the panel.
		 */
		$panel.on(
			'ajaxify:close',
			() => that.hide({
				target: that
			}));

		const that = {
			element: $panel.get(0),

			/**
			 * Puts HTML content into the panel.
			 *
			 * @param {string} bodyContent The HTML content to add.
			 * @param {string} title The title text (only applies to modals).
			 * @param {string} size The size (either nothing for default size, large or small, only applies to modals).
			 */
			fill: function (bodyContent, title, size, args) {
				that.clear(args);
				$panel.append(bodyContent);
			},

			/**
			 * Lazily adds the panel into the target container, if necessary.
			 * 
			 * @param {string} targetContainerSelector A DOM selector that determines where the request content should be placed on the page.
			 */
			append: function (targetContainerSelector, args) {
				if (!targetContainerSelector) {
					console.error('ajaxify: Target element must be specified when modals are disabled.');
					return;
				}

				const $targetContainer = $(targetContainerSelector);
				if ($targetContainer.length !== 1) {
					console.error('ajaxify: Target element not found or ambiguous selector.');
					return;
				}

				$panel.parent().removeClass('in'); // bootstrap 3+4
				$panel.parent().removeClass('show'); // bootstrap 5

				// remove all children except our ajax response target panel
				// usually this should be empty already, but when ajaxifying <form>s directly, we need to remove the original form 
				// and replace it with the one from the response
				$targetContainer.children().not($panel).remove();
				if (!$.contains($targetContainer, $panel)) {
					$targetContainer.append($panel);
				}
			},

			/**
			 * Displays the panel, if it is not already visible.
			 * 
			 * @param {string} targetContainerSelector A DOM selector that determines where the request content should be placed on the page.
			 */
			show: function (targetContainerSelector, args) {
				if (!targetContainerSelector) {
					console.error('ajaxify: Target element must be specified when modals are disabled.');
					return;
				}

				const $targetContainer = $(targetContainerSelector);
				if ($targetContainer.length !== 1) {
					console.error('ajaxify: Target element not found or ambiguous selector.');
					return;
				}

				$targetContainer.addClass('in'); // bootstrap 3+4
				$targetContainer.addClass('show'); // bootstrap 5

				$('body').trigger('ajaxify:opened', args);
			},

			/**
			 * Hides the panel and clears it.
			 */
			hide: function (args) {
				$('body').trigger('ajaxify:closing', args);

				$panel.parent().removeClass('in'); // bootstrap 3+4
				$panel.parent().removeClass('show'); // bootstrap 5

				// let animaions run through
				setTimeout(function () {
					that.clear();
					$('body').trigger('ajaxify:closed', args);
				}, 300);
			},

			/**
			 * We call this when the current panel is being closed, or before its content is being replaced.
			 */
			clear: function (args) {
				$panel.empty();

				$('body').trigger('ajaxify:cleared', args);
			}
		};

		return that;
	}

	/**
	 * Parses a response and gets the HTML contents of the body, if it exists.
	 * 
	 * @param {string} responseText The HTML code of the response we want to parse.
	 * @param {string} contentSelector The DOM selector that selects the part of the page that should be rendered.
	 * @return The contents of the response document's body as a jQuery.
	 */
	function parseBody(responseText, contentSelector) {
		const bodyMatchArray = responseText.match(/<body[^>]*>[\s\S]*<\/body>/gi);
		if (!bodyMatchArray || bodyMatchArray.length === 0) {
			return undefined;
		}

		// search the body for a fitting content element - 
		// either the specified contentSelector, the < main > element or the whole body, if nothing was specified
		// important: add contents to an empty div, otherwise find won't find anything if the main is the direct child
		const $body = $('<div>').append(bodyMatchArray[0]);
		if (contentSelector) {
			return $body.find(contentSelector).children();
		} else {
			const $main = $body.find('main');
			if ($main.length === 1) {
				return $main.children();
			} else {
				return $body.children();
			}
		}
	}

	/**
	 * Reads the HTML contents from a response, and puts it into the target element.
	 *
	 * @param {object} response The AJAX response, as in the ajax success callback.
	 */
	function openResponse(response, args) {
		const responseText = response.responseText;
		const target = args.target;
		const settings = args.settings;

		if (!responseText) {
			console.error('ajaxify: The page could not be displayed (responseText was empty).');
			const errorMessage = $('<p>');
			errorMessage.text('' + response.status + ': ' + response.statusText);

			target.fill(errorMessage, settings.title, settings.size, args);
			target.append(settings.targetContainerSelector, args);
			target.show(settings.targetContainerSelector, args);

			return;
		}

		const bodyContent = parseBody(responseText, settings.contentSelector);
		if (!bodyContent) {
			console.error('ajaxify: The page could not be displayed (no body content found).');

			target.fill($('<p>The page could not be displayed.</p>'), settings.title, settings.size, args);
			target.append(settings.targetContainerSelector, args);
			target.show(settings.targetContainerSelector, args);

			return;
		}

		target.fill(bodyContent, settings.title, settings.size, args);

		if (settings.handleFormSubmit) {
			// if the content contains a form, we put the response of the form submission into this modal as well
			// this allows for forms to be put in modals
			// if the body content is the form, register the event on it, otherwise search for the form
			const directFormChilds = bodyContent.toArray().filter(aContent => aContent.tagName.toLowerCase() === 'form');
			if (directFormChilds.length > 0) {
				$(directFormChilds).on('submit', event => handleAjaxSubmit(event, target, settings));
			} else {
				bodyContent.on('submit', 'form', event => handleAjaxSubmit(event, target, settings));
			}
		}

		target.append(settings.targetContainerSelector, args);
		$('body').trigger('ajaxify:ajax-content-loaded', args);
		target.show(settings.targetContainerSelector, args);
	}

	/**
	 * Handles a submit event asynchronously. The event gets prevented and converted into an AJAX request.
	 * 
	 * @param {object} event The original submit event.
	 * @param {object} target The target object in which the response will be shown.
	 * @param {object} settings The ajaxify settings object.
	 */
	function handleAjaxSubmit(event, target, settings) {
		const $form = $(event.currentTarget);

		// cancel the form submit and submit the form via ajax
		// idea being, that we wanna patch the response in the modal
		event.preventDefault();

		const url = $form.attr('action') || '';
		const method = $form.attr('method') || 'get';

		if (!url) {
			console.error('ajaxify: Form submit could not be ajax-ified, because the form action is empty.');
			return false;
		}

		const args = {
			url: url,
			target: target,
			settings: settings
		};

		const formData = $form.serializeArray();

		// in case we were submitted by a button that has a name and value, add this to the formData, because serialize will not be aware of it
		const $submitter = $(event.originalEvent.submitter);
		if ($submitter.length === 1) {
			const name = $submitter.attr('name');
			const value = $submitter.attr('value');
			if (name) {
				formData.push({
					name: name,
					value: value
				});
			}
		}

		$('body').trigger('ajaxify:opening', args);

		$.ajax({
			url: url,
			method: method,
			data: formData,
			dataType: 'text/html',
			complete: function (data) {
				openResponse(data, args);
			}
		});
	}

	/**
	 * Registers an event handler on links and forms that should be opened or submitted inline.
	 */
	$('body').on('click', '.ajaxify', ajaxify);

	/**
	 * Registers an event handler on links and forms that should be opened or submitted inline.
	 */
	$('body').on('submit', 'form.ajaxify', ajaxify);

	function ajaxify(event) {
		// forms only handle submit
		const isForm = event.currentTarget.tagName === 'FORM';
		if (event.type === 'click' && isForm) {
			return;
		}

		const $eventTarget = $(event.currentTarget);

		const settings = {
			title: $eventTarget.attr('title'),
			size: $eventTarget.data('modal-size'),
			contentSelector: $eventTarget.data('content-selector'),
			handleFormSubmit: !!$eventTarget.data('handle-form-submit'),
			targetContainerSelector: $eventTarget.data('target-container-selector')
		};

		// whether we use a modal or a panel
		const useModal = !settings.targetContainerSelector;
		const target = getTarget(useModal);

		// check whether .ajaxify was configured on a link or a form
		if (event.type === 'submit' && isForm) {
			handleAjaxSubmit(event, target, settings);
		} else {
			const url = $eventTarget.attr('href') || $eventTarget.data('target');
			if (!url) {
				console.error('ajaxify: Element cannot be ajaxified, because neither a href nor a data-target are specified.');
				return false;
			}

			const args = {
				url: url,
				target: target,
				settings: settings
			};

			$('body').trigger('ajaxify:opening', args);

			$.ajax({
				url: url,
				complete: function (data) {
					openResponse(data, args);
				}
			});
		}

		// disable default href or form-submit event behaviour
		return false;
	}
}());
