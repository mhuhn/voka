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

  Scenario: Create, switch and delete profiles under one signed-in account
    Given I open the Voka app
    And I sign in as "alice@example.test" with password "correct-password"
    When I create a profile named "Student"
    Then I can switch to the profile named "Alice"
    When I switch to the profile named "Student"
    And I open the profile page
    Then I can delete the profile named "Student"
    And I cannot delete the last profile

  Scenario: Profile names and emojis are editable only with multiple profiles
    Given I open the Voka app
    And I sign in as "alice@example.test" with password "correct-password"
    Then the single profile has no edit button
    When I create a profile named "Student"
    And I edit the current profile to "Panda Fan" with emoji "🐼"
    And I return to Voka from the profile page
    Then the floating profile button shows "🐼" for "Panda Fan"
    When I open the profile page
    And I switch to the profile named "Alice"
    Then the floating profile button shows "🙂" for "Alice"

  Scenario: Unique free-form emoji at profile creation
    Given I open the Voka app
    And I sign in as "alice@example.test" with password "correct-password"
    When I create a profile named "Crystal" with emoji "🔮"
    Then I cannot choose an emoji already used by another profile
    When I return to Voka from the profile page
    Then the floating profile button shows "🔮" for "Crystal"

  @de
  Scenario: German interface and unobtrusive version label
    Given my browser prefers German
    When I open the Voka app in German
    Then I see the German sign-in form
    And Google login is hidden
    And I see the version in the bottom-left corner

  @de
  Scenario: Profile actions in de
    Given I open the Voka app in the current locale
    When I sign in using the current locale as "alice@example.test" with password "correct-password"
    Then the profile heading is "Mein Profil"
    And the profile sign-out button is "Abmelden"
    And the account section heading is "Profile"
    And the add-account button is "Neues Profil"

  @fr
  Scenario: Profile actions in fr
    Given I open the Voka app in the current locale
    When I sign in using the current locale as "alice@example.test" with password "correct-password"
    Then the profile heading is "Mon profil"
    And the profile sign-out button is "Se déconnecter"
    And the account section heading is "Profils"
    And the add-account button is "Nouveau profil"

  @nl
  Scenario: Profile actions in nl
    Given I open the Voka app in the current locale
    When I sign in using the current locale as "alice@example.test" with password "correct-password"
    Then the profile heading is "Mijn profiel"
    And the profile sign-out button is "Uitloggen"
    And the account section heading is "Profielen"
    And the add-account button is "Nieuw profiel"

  @da
  Scenario: Profile actions in da
    Given I open the Voka app in the current locale
    When I sign in using the current locale as "alice@example.test" with password "correct-password"
    Then the profile heading is "Min profil"
    And the profile sign-out button is "Log ud"
    And the account section heading is "Profiler"
    And the add-account button is "Ny profil"

  @it
  Scenario: Profile actions in it
    Given I open the Voka app in the current locale
    When I sign in using the current locale as "alice@example.test" with password "correct-password"
    Then the profile heading is "Il mio profilo"
    And the profile sign-out button is "Esci"
    And the account section heading is "Profili"
    And the add-account button is "Nuovo profilo"

  Scenario: Sign-in and registration match the Voka theme
    Given I open the Voka app
    Then the sign-in form uses the Voka visual theme
    When I open registration
    Then the registration form keeps that visual theme

  Scenario: iOS PWA uses the original Voka home-screen icon
    Given I open the Voka app
    Then the Voka home-screen icon is explicitly linked on iOS

  Scenario: Profile selection does not expose additional account sign-in controls
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    Then the account profile has no green-themed controls

