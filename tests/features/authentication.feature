Feature: Account authentication
  The Voka app requires authentication before showing a profile.

  Scenario: Sign in and display the user's own profile
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    Then I see the profile for "alice@example.test"
    And I do not see the sign-in form

  Scenario: Registration requires email verification
    Given I open the Voka app
    When I open registration
    And I register "Alice" with email "alice@example.test" and password "correct-password"
    Then I see an email confirmation message

  Scenario: Request password reset
    Given I open the Voka app
    When I open password reset
    And I request a reset for "alice@example.test"
    Then I see a password reset message

  Scenario: Sign out
    Given I open the Voka app
    And I sign in as "alice@example.test" with password "correct-password"
    When I sign out
    Then I see the sign-in form

  Scenario: Add and switch between two persistent accounts
    Given I open the Voka app
    And I sign in as "alice@example.test" with password "correct-password"
    When I add another user
    And I sign in as "bob@example.test" with password "correct-password"
    Then I see the profile for "bob@example.test"
    When I switch to "alice@example.test"
    Then I see the profile for "alice@example.test"
    When I reload the app
    Then I see the profile for "alice@example.test"
    When I switch to "bob@example.test"
    Then I see the profile for "bob@example.test"

  @de
  Scenario: German interface and unobtrusive version label
    Given my browser prefers German
    When I open the Voka app in German
    Then I see the German sign-in form
    And Google login is hidden
    And I see the version in the bottom-left corner
