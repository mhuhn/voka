@voka
Feature: Share and import vocabulary lists
  A shared link carries an unguessable list ID, requires authentication and
  creates a separate copy under the receiving user's chosen subject.

  Scenario: Share an existing list through the supported share sheet
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open the English subject
    And I open the irregular verbs list
    Then the list share button calls the native share sheet with the list ID

  Scenario: Copy a shareable link when the browser has no share sheet
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open the English subject
    And I open the irregular verbs list
    Then sharing copies a usable link if no share sheet is supported

  Scenario: Sign in before choosing destination and importing a copy
    Given I open the Voka app
    When I open a shared-list invitation
    Then the app requires sign-in before importing the shared list
    When I sign in to import as "alice@example.test" with password "correct-password"
    Then the shared-list import dialog appears with the source details
    And I can import the shared list with my chosen subject title and tags

  Scenario: Cancel a shared-list import
    Given I open the Voka app
    When I open a shared-list invitation
    And I sign in to import as "alice@example.test" with password "correct-password"
    Then the shared-list import dialog appears with the source details
    And canceling the shared-list import leaves my lists untouched

  Scenario: An invalid or deleted source list cannot be imported
    Given I open the Voka app
    When I open a link to a missing shared list
    And I sign in to import as "alice@example.test" with password "correct-password"
    Then an unknown list cannot be imported
