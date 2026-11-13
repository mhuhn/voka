@voka
Feature: Vocabulary lists
  Signed-in learners can browse subjects, filter cards and use tablet and phone layouts.

  Scenario: Browse and filter an existing vocabulary list on a tablet
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    Then I see subjects grouped on the home screen
    And the initial subject group order and tablet subjects are correct
    When I open the English subject
    And I open the irregular verbs list
    Then the list detail is beside the complete subject list overview
    And the list header is compact without properties or learning notices
    And the list filters and sorting work
    And I can open the card editor without editing progress
    And the tablet card editor opens to the right of the full list details
    And the card editor occupies a third column

  Scenario: Export cards and import updates by card ID
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open the English subject
    And I open the irregular verbs list
    Then the list CSV download includes card IDs and both progress directions
    When I import CSV with one existing and one new card
    Then the CSV importer updates one card and adds one card

  Scenario: CSV actions remain available on small smartphones
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I switch to a phone-sized viewport
    And I open the English subject
    And I open the irregular verbs list
    Then CSV export and import buttons are visible in the phone list header

  Scenario: New lists for a language use its name as the answer label
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open the English subject
    Then the language list form uses automatic labels
    And the reverse-learning slider provides five levels

  Scenario: A phone shows only the editor for an opened card
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I switch to a phone-sized viewport
    And I open the English subject
    And I open the irregular verbs list
    Then I can open the card editor without editing progress
    And the phone card editor stands alone with a floating star

  Scenario: iPad landscape shows subject lists, cards and editor in three columns
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I switch to iPad landscape width
    And I open the English subject
    And I open the irregular verbs list
    Then the list detail is beside the complete subject list overview
    When I can open the card editor without editing progress
    Then the card editor occupies a third column

  Scenario: iPad list editing keeps the list overview visible
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I switch to iPad landscape width
    And I open the English subject
    And I open the irregular verbs list
    And I open list editing from its details
    Then the list editor stays beside the list overview

  Scenario: Cancel adding a card without creating it
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I switch to iPad landscape width
    And I open the English subject
    And I open the irregular verbs list
    And I open the add-card form
    Then I can cancel a new card without saving it

  Scenario: iPhone SE-sized floating controls are accessible
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I switch to a phone-sized viewport
    Then the small phone has larger floating icon targets

  @touch
  Scenario: iPad PWA provides larger touch controls
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    Then the iPad uses comfortably sized touch controls and typography

  Scenario: Subject detail does not offer editing
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open the English subject
    Then the subject details offer no edit control

  Scenario: Subject management opens a pure overview with local add actions
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open subject management
    Then the management overview shows add actions without an editor
    When I add a subject to the language group
    Then the subject editor opens in a cancelable dialog with the correct group
    And the group create and edit dialogs can be canceled

  Scenario: Cancel list editing on iPad without saving
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I switch to iPad landscape width
    And I open the English subject
    And I open the irregular verbs list
    And I open list editing from its details
    Then the list editor stays beside the list overview
    And the list editor cancel button discards unsaved changes

  Scenario: Add a subject to the selected group through the modal
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open subject management
    Then a new subject is saved through its group dialog

  Scenario: Edit a subject group through the modal
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open subject management
    Then an existing group is updated through the dialog

  Scenario: Cards can be sorted by position independently from points
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open the English subject
    And I open the irregular verbs list
    Then cards sort by increasing position

  Scenario: Question and answer inputs display the list's own labels
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open the English subject
    And I open the irregular verbs list
    Then the card editor uses its list's question and answer labels

  Scenario: A new language subject automatically receives its flag
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open subject management
    And I add a subject to the language group
    Then the language subject name suggests the matching flag

  Scenario: New school subjects automatically receive topic emojis
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open subject management
    Then other school subjects suggest the matching emoji
